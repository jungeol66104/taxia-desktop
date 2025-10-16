import React, { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { ResizableTable, MessageInput } from '../shared';
import { Column, Client, Message, User } from '../../../shared/types';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { getInitials } from '../../../shared/utils';

const ClientsTab = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [tpRecordingEnabled, setTpRecordingEnabled] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Load clients and users on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clientsData, usersData, tpEnabled] = await Promise.all([
          window.electronAPI.getAllClients(),
          window.electronAPI.getAllUsers(),
          window.electronAPI.getSetting('tpRecordingEnabled')
        ]);
        setClients(clientsData);
        setUsers(usersData);
        setSelectedClient(clientsData[0] || null);
        setTpRecordingEnabled(tpEnabled === 'true');
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Listen for TP recording setting changes
    const handleTpRecordingChanged = (event: CustomEvent) => {
      setTpRecordingEnabled(event.detail.enabled);
    };
    window.addEventListener('tpRecordingChanged', handleTpRecordingChanged as EventListener);

    return () => {
      window.removeEventListener('tpRecordingChanged', handleTpRecordingChanged as EventListener);
    };
  }, []);

  // Load messages when selected client changes
  useEffect(() => {
    const loadMessages = async () => {
      if (selectedClient) {
        try {
          const data = await window.electronAPI.getMessagesByContext({ clientId: selectedClient.id });
          setMessages(data);
        } catch (error) {
          console.error('Failed to load messages:', error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    };

    loadMessages();
  }, [selectedClient]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !selectedClient) return;

    try {
      // Get current user or use admin as default
      const user = await window.electronAPI.getUserByRole('admin') ||
                   await window.electronAPI.getUserByRole('user');

      if (!user) {
        console.error('No user found');
        return;
      }

      const messageData = {
        userId: user.id,
        content: message.trim(),
        clientId: selectedClient.id
      };

      const newMsg = await window.electronAPI.createMessage(messageData);
      setMessages([...messages, newMsg]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleCellEdit = async (clientKey: string | number, columnKey: string, newValue: any) => {
    try {
      // Find the client to update
      const clientToUpdate = clients.find(client => client.id === clientKey);
      if (!clientToUpdate) return;

      // Create updated client object
      const updatedClient = {
        ...clientToUpdate,
        [columnKey]: newValue
      };

      // Update via API
      await window.electronAPI.updateClient(clientToUpdate.id, updatedClient);

      // Update local state
      setClients(prevClients =>
        prevClients.map(client =>
          client.id === clientKey ? updatedClient : client
        )
      );

      // Update selected client if it's the one being edited
      if (selectedClient?.id === clientKey) {
        setSelectedClient(updatedClient);
      }
    } catch (error) {
      console.error('Failed to update client:', error);
      alert('수임처 정보 업데이트에 실패했습니다.');
    }
  };

  const handleClientDelete = async (client: Client) => {
    if (window.confirm(`"${client.companyName}" 수임처를 삭제하시겠습니까?`)) {
      try {
        await window.electronAPI.deleteClient(client.id);
        setClients(clients.filter(c => c.id !== client.id));

        // Clear selection if deleted client was selected
        if (selectedClient?.id === client.id) {
          setSelectedClient(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('수임처 삭제에 실패했습니다:', error);
        alert('수임처 삭제에 실패했습니다.');
      }
    }
  };

  // Custom cell dropdown component for assignee
  const AssigneeCell = ({ value, onChange, client }: { value: string, onChange: (newValue: string) => void, client: Client }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [position, setPosition] = React.useState({ top: 0, left: 0 });

    const filteredUsers = users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getUserInitials = (name: string | null | undefined) => {
      return getInitials(name);
    };

    // Use effect to detect when this cell is selected and open dropdown
    React.useEffect(() => {
      const cellElement = document.querySelector(`[data-cell-key="${client.id}-assignee"]`) as HTMLElement;
      if (cellElement) {
        const handleCellSelect = (e: Event) => {
          // Get the exact cell boundaries
          const rect = cellElement.getBoundingClientRect();

          // Position dropdown below the selected cell
          setPosition({
            top: rect.bottom,
            left: rect.left
          });
          setIsOpen(true);
        };

        // Listen for both focus and click events
        cellElement.addEventListener('focus', handleCellSelect);
        cellElement.addEventListener('click', handleCellSelect);

        return () => {
          cellElement.removeEventListener('focus', handleCellSelect);
          cellElement.removeEventListener('click', handleCellSelect);
        };
      }
    }, [client.id]);

    // Close dropdown when clicking outside or pressing escape
    React.useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    return (
      <>
        <span className="truncate">
          {value || ''}
        </span>

        {isOpen && (
          <div
            className="fixed w-64 bg-white shadow-lg z-[100] rounded-lg border border-[#ededed]"
            style={{
              top: position.top,
              left: position.left
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#ededed]">
              <input
                type="text"
                placeholder="사용자 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full p-2 text-sm bg-white focus:outline-none rounded-t-lg"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              <p className="text-xs text-gray-500 pt-1 pb-2 px-1">여러 명을 선택할 수 있습니다</p>
              {filteredUsers.length === 0 && !searchQuery && (
                <div className="px-2 text-sm text-gray-500" style={{ height: '28px', display: 'flex', alignItems: 'center' }}>
                  사용자를 검색해주세요
                </div>
              )}
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    onChange(user.name);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-3 px-2 cursor-pointer rounded-md transition-colors duration-150 ${
                    value === user.name ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  style={{ height: '28px' }}
                >
                  <div className="w-4 h-4 bg-gray-600 text-white text-xs flex items-center justify-center rounded">
                    {getUserInitials(user.name)}
                  </div>
                  <span className="text-sm text-gray-700">{user.name}</span>
                </div>
              ))}
              {filteredUsers.length === 0 && searchQuery && (
                <div className="px-2 text-sm text-gray-500" style={{ height: '28px', display: 'flex', alignItems: 'center' }}>
                  사용자를 찾을 수 없습니다
                </div>
              )}
            </div>
          </div>
        )}

        {isOpen && (
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
          />
        )}
      </>
    );
  };

  const clientColumns: Column[] = [
    { key: 'companyName', label: '상호', width: 140, editable: true },
    {
      key: 'assignee',
      label: '담당자',
      width: 80,
      editable: false, // Disable default editing since we use custom renderer
      render: (value: string, client: Client) => (
        <AssigneeCell
          value={value}
          onChange={(newValue) => handleCellEdit(client.id, 'assignee', newValue)}
          client={client}
        />
      )
    },
    { key: 'representative', label: '대표자', width: 80, editable: true },
    { key: 'contactNumber', label: '전화번호', width: 100, editable: true },
    ...(tpRecordingEnabled ? [
      { key: 'tpCode', label: 'TP 코드', width: 80, editable: true }
    ] : [])
  ];

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal">
        {/* Left Panel - Client List */}
        <Panel defaultSize={70} minSize={40} style={{ zIndex: 10 }}>
          <div className="h-full bg-white border-r border-gray-200 rounded-tl-lg rounded-bl-lg overflow-hidden flex flex-col">
            <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0" style={{ height: '48px' }}>
              <h2 className="text-xl font-semibold text-gray-800">수임처 목록</h2>
              <button
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                onClick={async () => {
                  try {
                    const newClient = await window.electronAPI.createClient({
                      companyName: '',
                      representative: '',
                      businessRegistrationNumber: '',
                      contactNumber: '',
                      email: '',
                      address: '',
                      assignee: '',
                      contractDate: new Date().toISOString().split('T')[0],
                      status: 'active'
                    });

                    // Add to local state and select
                    setClients([newClient, ...clients]);
                    setSelectedClient(newClient);

                    // Focus on first input
                    setTimeout(() => {
                      firstInputRef.current?.focus();
                    }, 0);
                  } catch (error) {
                    console.error('Failed to create client:', error);
                  }
                }}
                title="새 수임처 추가"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500">로딩 중...</div>
              </div>
            ) : (
              <ResizableTable
                columns={clientColumns}
                data={clients}
                selectedItem={selectedClient}
                onItemSelect={setSelectedClient}
                getItemKey={(client) => client.id}
                emptyStateText="등록된 고객이 없습니다."
                onCellEdit={handleCellEdit}
                onItemDelete={handleClientDelete}
              />
            )}
          </div>
        </Panel>

        <PanelResizeHandle
          className="w-0.5 bg-gray-300"
          style={{ zIndex: 5 }}
        />

        {/* Right Panel - Messages Thread */}
        <Panel defaultSize={60} minSize={25} style={{ zIndex: 10 }}>
          <div className="h-full bg-white rounded-tr-lg rounded-br-lg overflow-hidden flex flex-col">
            <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0" style={{ height: '48px' }}>
              <h3 className="text-xl font-semibold text-gray-800">스레드</h3>
            </div>

            {/* Messages List */}
            {!selectedClient ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500 text-sm">수임처를 선택해주세요.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500 text-sm">메시지가 없습니다.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((message) => (
                  <div key={message.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {message.user?.name || 'Unknown User'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Message Input */}
            {selectedClient && (
              <MessageInput
                onSendMessage={handleSendMessage}
                placeholder="메시지를 입력하세요..."
              />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ClientsTab;