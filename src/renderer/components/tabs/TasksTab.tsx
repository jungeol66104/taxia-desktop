import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { EllipsisHorizontalIcon, CheckCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline';
import { ListFilter } from 'lucide-react';
import { ResizableTable, MessageInput } from '../shared';
import { Column, Task, Subtask, Message, User, Client } from '../../../shared/types';
import { getInitials } from '../../../shared/utils';

const TasksTab = ({ isActive }: { isActive?: boolean }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Load tasks and users on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [tasksData, usersData, clientsData] = await Promise.all([
          window.electronAPI.getAllTasks(),
          window.electronAPI.getAllUsers(),
          window.electronAPI.getAllClients()
        ]);
        setTasks(tasksData);
        setUsers(usersData);
        setClients(clientsData);
        setSelectedTask(tasksData[0] || null);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Reload data when tab becomes active
  useEffect(() => {
    if (isActive) {
      const reloadData = async () => {
        try {
          const [tasksData, usersData, clientsData] = await Promise.all([
            window.electronAPI.getAllTasks(),
            window.electronAPI.getAllUsers(),
            window.electronAPI.getAllClients()
          ]);

          console.log('🔄 TAB REACTIVATED - DATA RELOADED:', {
            tasksCount: tasksData.length,
            tasksWithClientIds: tasksData.map(t => ({
              id: t.id,
              title: t.title,
              clientId: t.clientId,
              clientName: t.clientName
            })),
            clientsCount: clientsData.length,
            clients: clientsData.map(c => ({ id: c.id, name: c.companyName }))
          });

          setTasks(tasksData);
          setUsers(usersData);
          setClients(clientsData);
        } catch (error) {
          console.error('Failed to reload data:', error);
        }
      };

      reloadData();
    }
  }, [isActive]);

  // Load subtasks when selected task changes
  useEffect(() => {
    const loadSubtasks = async () => {
      if (selectedTask) {
        try {
          const data = await window.electronAPI.getSubtasksByTaskId(selectedTask.id);
          setSubtasks(data || []);
        } catch (error) {
          console.error('Failed to load subtasks:', error);
          setSubtasks([]);
        }
      } else {
        setSubtasks([]);
      }
    };

    loadSubtasks();
    setSelectedSubtask(null); // Reset subtask selection when task changes
  }, [selectedTask]);

  // Load messages when selected task changes
  useEffect(() => {
    const loadMessages = async () => {
      if (selectedTask) {
        try {
          const data = await window.electronAPI.getMessagesByContext({ taskId: selectedTask.id });
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
  }, [selectedTask]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !selectedTask) return;

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
        taskId: selectedTask.id
      };

      const newMsg = await window.electronAPI.createMessage(messageData);
      setMessages([...messages, newMsg]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTaskCellEdit = async (taskKey: string | number, columnKey: string, newValue: any) => {
    try {
      // Find the task to update
      const taskToUpdate = tasks.find(task => task.id === taskKey);
      if (!taskToUpdate) {
        console.error('🔴 TASK NOT FOUND:', { taskKey, tasks: tasks.map(t => t.id) });
        return;
      }

      console.log('🟢 BEFORE UPDATE:', {
        taskKey,
        columnKey,
        newValue,
        originalTask: taskToUpdate,
        hasClientId: taskToUpdate.clientId !== undefined,
        originalClientId: taskToUpdate.clientId
      });

      // Create updated task object
      const updatedTask = {
        ...taskToUpdate,
        [columnKey]: newValue
      };

      console.log('🟢 AFTER UPDATE CREATION:', {
        taskId: taskToUpdate.id,
        columnKey,
        newValue,
        updatedTask,
        hasClientIdAfter: updatedTask.clientId !== undefined,
        clientIdAfter: updatedTask.clientId
      });

      // Update via API
      await window.electronAPI.updateTask(taskToUpdate.id, updatedTask);

      console.log('🟢 API UPDATE SUCCESS');

      // Update local state
      setTasks(prevTasks => {
        const newTasks = prevTasks.map(task =>
          task.id === taskKey ? updatedTask : task
        );
        console.log('🟢 LOCAL STATE UPDATED:', {
          updatedTaskId: taskKey,
          newTasksWithClientIds: newTasks.map(t => ({ id: t.id, clientId: t.clientId, clientName: t.clientName }))
        });
        return newTasks;
      });

      // Update selected task if it's the one being edited
      if (selectedTask?.id === taskKey) {
        setSelectedTask(updatedTask);
        console.log('🟢 SELECTED TASK UPDATED:', updatedTask);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('업무 정보 업데이트에 실패했습니다.');
    }
  };

  const handleSubtaskCellEdit = async (subtaskKey: string | number, columnKey: string, newValue: any) => {
    try {
      // Find the subtask to update
      const subtaskToUpdate = subtasks.find(subtask => subtask.id === subtaskKey);
      if (!subtaskToUpdate) return;

      // Create updated subtask object
      const updatedSubtask = {
        ...subtaskToUpdate,
        [columnKey]: newValue
      };

      // Update via API
      await window.electronAPI.updateSubtask(subtaskToUpdate.id, updatedSubtask);

      // Update local state
      setSubtasks(prevSubtasks =>
        prevSubtasks.map(subtask =>
          subtask.id === subtaskKey ? updatedSubtask : subtask
        )
      );

      // Update selected subtask if it's the one being edited
      if (selectedSubtask?.id === subtaskKey) {
        setSelectedSubtask(updatedSubtask);
      }
    } catch (error) {
      console.error('Failed to update subtask:', error);
      alert('하위업무 정보 업데이트에 실패했습니다.');
    }
  };

  const handleTaskDelete = async (task: Task) => {
    if (window.confirm(`"${task.title}" 업무를 삭제하시겠습니까?`)) {
      try {
        await window.electronAPI.deleteTask(task.id);
        setTasks(tasks.filter(t => t.id !== task.id));

        // Clear selection if deleted task was selected
        if (selectedTask?.id === task.id) {
          setSelectedTask(null);
          setSubtasks([]);
          setMessages([]);
        }
      } catch (error) {
        console.error('업무 삭제에 실패했습니다:', error);
        alert('업무 삭제에 실패했습니다.');
      }
    }
  };

  const handleSubtaskDelete = async (subtask: Subtask) => {
    if (window.confirm(`"${subtask.title}" 하위업무를 삭제하시겠습니까?`)) {
      try {
        await window.electronAPI.deleteSubtask(subtask.id);
        setSubtasks(subtasks.filter(s => s.id !== subtask.id));

        // Clear selection if deleted subtask was selected
        if (selectedSubtask?.id === subtask.id) {
          setSelectedSubtask(null);
        }
      } catch (error) {
        console.error('하위업무 삭제에 실패했습니다:', error);
        alert('하위업무 삭제에 실패했습니다.');
      }
    }
  };

  // Custom cell dropdown component for assignee
  const AssigneeCell = ({ value, onChange, item }: { value: string, onChange: (newValue: string) => void, item: Task | Subtask }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const cellRef = React.useRef<HTMLElement>(null);

    const filteredUsers = users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getUserInitials = (name: string | null | undefined) => {
      return getInitials(name);
    };

    // Use effect to detect when this cell is selected and open dropdown
    React.useEffect(() => {
      const cellElement = document.querySelector(`[data-cell-key="${item.id}-assignee"]`) as HTMLElement;
      if (cellElement) {
        cellRef.current = cellElement;
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
    }, [item.id]);

    // Close dropdown when clicking outside or pressing escape
    React.useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        const isClickInDropdown = dropdownRef.current?.contains(target);
        const isClickInCell = cellRef.current?.contains(target);

        if (!isClickInDropdown && !isClickInCell) {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    return (
      <>
        <span className="truncate">
          {value || ''}
        </span>

        {isOpen && createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-64 bg-white shadow-lg z-[9999] rounded-lg border border-[#ededed]"
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
              <p className="text-xs text-gray-500 pt-1 pb-2 px-1">담당자를 선택하세요</p>
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
          </div>,
          document.body
        )}
      </>
    );
  };

  // Custom cell dropdown component for client
  const ClientCell = ({ value, onChange, item, currentClientId }: { value: string, onChange: (newValue: string) => void, item: Task | Subtask, currentClientId?: string }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    const clientDropdownRef = React.useRef<HTMLDivElement>(null);
    const clientCellRef = React.useRef<HTMLElement>(null);

    const filteredClients = clients.filter(client =>
      client.companyName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Use effect to detect when this cell is selected and open dropdown
    React.useEffect(() => {
      const cellElement = document.querySelector(`[data-cell-key="${item.id}-clientId"]`) as HTMLElement;
      if (cellElement) {
        clientCellRef.current = cellElement;
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
    }, [item.id]);

    // Close dropdown when clicking outside or pressing escape
    React.useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        const isClickInDropdown = clientDropdownRef.current?.contains(target);
        const isClickInCell = clientCellRef.current?.contains(target);

        if (!isClickInDropdown && !isClickInCell) {
          setIsOpen(false);
          setSearchQuery('');
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    return (
      <>
        <span className="truncate">
          {value || ''}
        </span>

        {isOpen && createPortal(
          <div
            ref={clientDropdownRef}
            className="fixed w-64 bg-white shadow-lg z-[9999] rounded-lg border border-[#ededed]"
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
                placeholder="수임처 검색..."
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
              <p className="text-xs text-gray-500 pt-1 pb-2 px-1">수임처를 선택하세요</p>
              {filteredClients.length === 0 && !searchQuery && (
                <div className="px-2 text-sm text-gray-500" style={{ height: '28px', display: 'flex', alignItems: 'center' }}>
                  수임처를 검색해주세요
                </div>
              )}
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => {
                    console.log('🔵 CLIENT SELECTION:', {
                      selectedClient: client,
                      clientId: client.id,
                      companyName: client.companyName,
                      currentTask: item
                    });
                    onChange(client.id);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-3 px-2 cursor-pointer rounded-md transition-colors duration-150 ${
                    currentClientId === client.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  style={{ height: '28px' }}
                >
                  <span className="text-sm text-gray-700">{client.companyName}</span>
                </div>
              ))}
              {filteredClients.length === 0 && searchQuery && (
                <div className="px-2 text-sm text-gray-500" style={{ height: '28px', display: 'flex', alignItems: 'center' }}>
                  수임처를 찾을 수 없습니다
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };

  const taskColumns: Column[] = [
    { key: 'startDate', label: '일자', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    { key: 'title', label: '제목', width: 300, editable: true },
    {
      key: 'status',
      label: '상태',
      width: 60,
      minWidth: 50,
      editable: true,
      render: (status) => (
        <div className="flex justify-center">
          {status === 'completed' ? (
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          ) : (
            <MinusCircleIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      )
    },
    { key: 'dueDate', label: '마감기한', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    {
      key: 'assignee',
      label: '담당자',
      width: 80,
      editable: false, // Disable default editing since we use custom renderer
      render: (value: string, task: Task) => (
        <AssigneeCell
          value={value}
          onChange={(newValue) => handleTaskCellEdit(task.id, 'assignee', newValue)}
          item={task}
        />
      )
    },
    {
      key: 'clientId',
      label: '수임처',
      width: 140,
      editable: false, // Disable default editing since we use custom renderer
      render: (clientId: string, task: Task) => {
        // Find the client to display the company name
        const client = clients.find(c => c.id === clientId);
        const displayValue = client ? client.companyName : '';

        console.log('🟡 COLUMN RENDER:', {
          taskId: task.id,
          clientId: clientId,
          foundClient: client,
          displayValue: displayValue,
          allClients: clients.map(c => ({id: c.id, name: c.companyName}))
        });

        return (
          <ClientCell
            value={displayValue}
            onChange={(newClientId) => {
              console.log('🟠 CLIENT CELL CHANGE:', {
                taskId: task.id,
                oldClientId: clientId,
                newClientId: newClientId,
                task: task
              });
              handleTaskCellEdit(task.id, 'clientId', newClientId);
            }}
            item={task}
            currentClientId={clientId}
          />
        );
      }
    },
    { key: 'category', label: '구분', width: 100, editable: true }
  ];

  const subtaskColumns: Column[] = [
    { key: 'startDate', label: '일자', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    { key: 'title', label: '제목', width: 300, editable: true },
    { key: 'status', label: '상태', width: 80, editable: true },
    { key: 'dueDate', label: '마감기한', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    {
      key: 'assignee',
      label: '담당자',
      width: 80,
      editable: false, // Disable default editing since we use custom renderer
      render: (value: string, subtask: Subtask) => (
        <AssigneeCell
          value={value}
          onChange={(newValue) => handleSubtaskCellEdit(subtask.id, 'assignee', newValue)}
          item={subtask}
        />
      )
    }
  ];

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal">
        {/* Left Panel - Tasks and Subtasks */}
        <Panel defaultSize={70} minSize={40} style={{ zIndex: 10 }}>
          <PanelGroup direction="vertical">
            {/* Top Panel - Task List */}
            <Panel defaultSize={60} minSize={30}>
              <div className="h-full bg-white border-r border-gray-200 border-b border-gray-200 overflow-hidden flex flex-col">
                <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 rounded-tr-lg" style={{ height: '48px' }}>
                  <h2 className="text-xl font-semibold text-gray-800">업무 목록</h2>
                  <div className="flex items-center gap-2">
                    <button
                      className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      title="필터"
                    >
                      <ListFilter className="w-4 h-4" />
                    </button>
                    <button
                      className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      onClick={async () => {
                        try {
                          const newTask = await window.electronAPI.createTask({
                            title: '',
                            description: '',
                            status: 'pending',
                            priority: 'medium',
                            assignee: '',
                            startDate: new Date().toISOString(),
                            dueDate: new Date().toISOString(),
                            category: '',
                            tags: '',
                            client: '',
                            hours: 0
                          });

                          // Add to local state and select
                          setTasks([newTask, ...tasks]);
                          setSelectedTask(newTask);

                          // Focus on first input
                          setTimeout(() => {
                            firstInputRef.current?.focus();
                          }, 0);
                        } catch (error) {
                          console.error('Failed to create task:', error);
                        }
                      }}
                      title="새 업무 추가"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-gray-500 text-sm">로딩 중...</div>
                  </div>
                ) : (
                  <ResizableTable
                    columns={taskColumns}
                    data={tasks}
                    selectedItem={selectedTask}
                    onItemSelect={setSelectedTask}
                    getItemKey={(task) => task.id}
                    emptyStateText="업무가 없습니다."
                    onCellEdit={handleTaskCellEdit}
                    onItemDelete={handleTaskDelete}
                  />
                )}
              </div>
            </Panel>

            <PanelResizeHandle
              className="h-0.5 bg-gray-300"
              style={{ zIndex: 5 }}
            />

            {/* Bottom Panel - Subtask List */}
            <Panel defaultSize={40} minSize={20}>
              <div className="h-full bg-white border-r border-gray-200 overflow-hidden flex flex-col">
                <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0" style={{ height: '48px' }}>
                  <h2 className="text-xl font-semibold text-gray-800">하위 업무 목록</h2>
                  <div className="flex items-center gap-2">
                    <button
                      className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      onClick={async () => {
                        if (!selectedTask) {
                          alert('먼저 상위 업무를 선택해주세요.');
                          return;
                        }
                        try {
                          const newSubtask = await window.electronAPI.createSubtask({
                            title: '',
                            description: '',
                            status: 'pending',
                            assignee: '',
                            dueDate: new Date().toISOString(),
                            taskId: selectedTask.id
                          });

                          // Add to local state and select
                          setSubtasks([newSubtask, ...subtasks]);
                          setSelectedSubtask(newSubtask);
                        } catch (error) {
                          console.error('Failed to create subtask:', error);
                        }
                      }}
                      title="새 하위업무 추가"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {!selectedTask ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-gray-500 text-sm">상위 업무를 선택해주세요.</div>
                  </div>
                ) : (
                  <ResizableTable
                    columns={subtaskColumns}
                    data={subtasks}
                    selectedItem={selectedSubtask}
                    onItemSelect={setSelectedSubtask}
                    getItemKey={(subtask) => subtask.id}
                    emptyStateText="하위업무가 없습니다."
                    onCellEdit={handleSubtaskCellEdit}
                    onItemDelete={handleSubtaskDelete}
                  />
                )}
              </div>
            </Panel>
          </PanelGroup>
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
            {!selectedTask ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500 text-sm">상위 업무를 선택해주세요.</p>
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
            {selectedTask && (
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

export default TasksTab;