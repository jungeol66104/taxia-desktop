import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid, PauseIcon as PauseIconSolid } from '@heroicons/react/24/solid';
import { FileText } from 'lucide-react';
import { ResizableTable, MessageInput } from '../shared';
import { Column, Call, User } from '../../../shared/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { getInitials } from '../../../shared/utils';


// Empty conversations object - will be populated dynamically when calls are processed
const callConversations = {};

// Type for candidate tasks
interface CandidateTask {
  id: string;
  startDate: string;
  title: string;
  assignee: string;
  dueDate: string;
  clientId?: string;
  clientName?: string;
}

const CallsTab = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [callConversationsState, setCallConversationsState] = useState(callConversations);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [candidateTasks, setCandidateTasks] = useState<CandidateTask[]>([]);
  const [selectedCandidateTask, setSelectedCandidateTask] = useState<CandidateTask | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const loadCalls = async () => {
      try {
        setLoading(true);
        const [callsData, usersData, clientsData] = await Promise.all([
          window.electronAPI.getAllCalls(),
          window.electronAPI.getAllUsers(),
          window.electronAPI.getAllClients()
        ]);
        setCalls(callsData);
        setUsers(usersData);
        setClients(clientsData);
        setSelectedCall(callsData[0] || null);

        // HIDDEN: Add dummy message for the first call with candidate tasks
        // Commented out for now, will be replaced by real LLM extraction
        /*
        if (callsData[0]) {
          const dummyCandidateTasks: CandidateTask[] = [
            {
              id: 1,
              startDate: new Date().toISOString(),
              title: '나머지 엑셀 파일 카톡으로 전송',
              assignee: '',
              dueDate: new Date().toISOString()
            },
            {
              id: 2,
              startDate: new Date().toISOString(),
              title: '미수 건 재연락 - 엑스 표시된 중간 미수 건들 한 번씩 더 전화',
              assignee: '',
              dueDate: new Date().toISOString()
            },
            {
              id: 3,
              startDate: new Date().toISOString(),
              title: '파트너테크 출금 처리 - 9월분 출금',
              assignee: '',
              dueDate: new Date(Date.now() + 86400000).toISOString()
            },
            {
              id: 4,
              startDate: new Date().toISOString(),
              title: '태적 시스템 개인 등록 - 등록만 해두고 정기 출금은 설정하지 말 것',
              assignee: '',
              dueDate: new Date().toISOString()
            },
            {
              id: 5,
              startDate: new Date().toISOString(),
              title: '법인 태적 출금 - 7월분부터 한 번에 출금',
              assignee: '',
              dueDate: new Date().toISOString()
            },
            {
              id: 6,
              startDate: new Date().toISOString(),
              title: '기장계약서 담당자 명확히 정하기 - CMS 등록 누락 방지',
              assignee: '',
              dueDate: new Date(Date.now() + 3 * 86400000).toISOString()
            },
            {
              id: 7,
              startDate: new Date().toISOString(),
              title: '신규 고객 온보딩 프로세스 확립 - CMS 등록 지연 문제 해결',
              assignee: '',
              dueDate: new Date(Date.now() + 3 * 86400000).toISOString()
            }
          ];

          setCandidateTasks(dummyCandidateTasks);

          setCallConversationsState({
            ...callConversations,
            [callsData[0].id]: [
              {
                id: 1,
                author: 'Taxia',
                timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                content: '통화 내용에서 다음 업무들을 추출했습니다:',
                type: 'taxia',
                hasCandidateTasks: true
              }
            ]
          });
        }
        */
      } catch (error) {
        console.error('Failed to load calls:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCalls();
  }, []);

  // Define the type for call column keys
  type CallColumnKey = 'date' | 'callerName' | 'clientName' | 'phoneNumber' | 'callDuration';

  const callColumns: Column[] = [
    { key: 'date', label: '일자', width: 120 },
    { key: 'callerName', label: '통화자', width: 80 },
    { key: 'clientName', label: '수임처', width: 140 },
    { key: 'phoneNumber', label: '전화번호', width: 120 },
    { key: 'callDuration', label: '통화길이', width: 80 }
  ];
  const [columnWidths, setColumnWidths] = useState<Record<CallColumnKey, number>>({
    date: 120,
    callerName: 80,
    clientName: 140,
    phoneNumber: 120,
    callDuration: 80
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<CallColumnKey | null>(null);

  // Custom cell dropdown component for client (for candidate tasks)
  const ClientCell = ({ value, onChange, item, currentClientId }: { value: string, onChange: (newValue: string) => void, item: CandidateTask, currentClientId?: string }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    const clientDropdownRef = React.useRef<HTMLDivElement>(null);
    const clientCellRef = React.useRef<HTMLElement>(null);

    const filteredClients = clients.filter(client =>
      client.companyName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    React.useEffect(() => {
      const cellElement = document.querySelector(`[data-cell-key="${item.id}-clientId"]`) as HTMLElement;
      if (cellElement) {
        clientCellRef.current = cellElement;
        const handleCellSelect = (e: Event) => {
          const rect = cellElement.getBoundingClientRect();
          setPosition({
            top: rect.bottom,
            left: rect.left
          });
          setIsOpen(true);
        };

        cellElement.addEventListener('focus', handleCellSelect);
        cellElement.addEventListener('click', handleCellSelect);

        return () => {
          cellElement.removeEventListener('focus', handleCellSelect);
          cellElement.removeEventListener('click', handleCellSelect);
        };
      }
    }, [item.id]);

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

  // Candidate task columns (matches 업무 tab structure and ordering)
  const candidateTaskColumns: Column[] = [
    { key: 'startDate', label: '일자', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    { key: 'title', label: '제목', width: 300, editable: true },
    { key: 'dueDate', label: '마감기한', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    {
      key: 'assignee',
      label: '담당자',
      width: 80,
      editable: false,
      render: (value: string, task: CandidateTask) => (
        <AssigneeCell
          value={value}
          onChange={(newValue) => handleCandidateTaskCellEdit(task.id, 'assignee', newValue)}
          item={task}
        />
      )
    },
    {
      key: 'clientId',
      label: '수임처',
      width: 140,
      editable: false,
      render: (clientId: string, task: CandidateTask) => {
        const client = clients.find(c => c.id === clientId);
        const displayValue = client ? client.companyName : '';

        return (
          <ClientCell
            value={displayValue}
            onChange={(newClientId) => {
              handleCandidateTaskCellEdit(task.id, 'clientId', newClientId);
            }}
            item={task}
            currentClientId={clientId}
          />
        );
      }
    }
  ];

  // Setup IPC event listeners
  useEffect(() => {
    console.log('🔧 FRONTEND: CallsTab component mounted');
    console.log('🔧 FRONTEND: Window object available:', typeof window !== 'undefined');
    console.log('🔧 FRONTEND: electronAPI available:', typeof (window as any)?.electronAPI);
    console.log('🔧 FRONTEND: electronAPI object:', (window as any)?.electronAPI);

    // Check if electronAPI is available
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const electronAPI = (window as any).electronAPI;
      console.log('✅ FRONTEND: electronAPI found, setting up listeners...');

      // Log all available methods
      console.log('📋 FRONTEND: Available electronAPI methods:', Object.keys(electronAPI));

      // Register all event listeners with detailed logging
      console.log('🔗 FRONTEND: Registering onFileDetected...');
      electronAPI.onFileDetected((fileInfo: any) => {
        console.log('📁 FRONTEND: File detected event received!', fileInfo);
        handleFileDetected(fileInfo);
      });

      console.log('🔗 FRONTEND: Registering onCreateNewCall...');
      electronAPI.onCreateNewCall((data: any) => {
        console.log('📞 FRONTEND: Create new call event received!', data);
        handleCreateNewCall(data);
      });

      console.log('🔗 FRONTEND: Registering onConversationMessage...');
      electronAPI.onConversationMessage((data: any) => {
        console.log('💬 FRONTEND: Conversation message event received!', data);
        handleConversationMessage(data);
      });

      console.log('🔗 FRONTEND: Registering onFileProcessed...');
      electronAPI.onFileProcessed((data: any) => {
        console.log('📝 FRONTEND: File processed event received!', data);
        handleFileProcessed(data);
      });

      console.log('🔗 FRONTEND: Registering onTasksExtracted...');
      electronAPI.onTasksExtracted((data: any) => {
        console.log('✅ FRONTEND: Tasks extracted event received!', data);
        handleTasksExtracted(data);
      });

      console.log('🔗 FRONTEND: Registering onTranscriptUpdated...');
      electronAPI.onTranscriptUpdated((data: any) => {
        console.log('📝 FRONTEND: Transcript updated event received!', data);
        handleTranscriptUpdated(data);
      });

      console.log('✅ FRONTEND: All IPC event listeners registered successfully');

      // Cleanup function to remove listeners
      return () => {
        console.log('🧹 FRONTEND: Cleaning up IPC event listeners');
        electronAPI.removeAllListeners('file-detected');
        electronAPI.removeAllListeners('create-new-call');
        electronAPI.removeAllListeners('conversation-message');
        electronAPI.removeAllListeners('file-processed');
        electronAPI.removeAllListeners('tasks-extracted');
        electronAPI.removeAllListeners('transcript-updated');
        console.log('🧹 FRONTEND: IPC cleanup completed');
      };
    } else {
      console.warn('⚠️  FRONTEND: electronAPI not available!');
      console.warn('⚠️  FRONTEND: Window object:', typeof window);
      console.warn('⚠️  FRONTEND: electronAPI object:', (window as any)?.electronAPI);
      console.warn('⚠️  FRONTEND: Running simplified test in 5 seconds...');

      // Fallback: Simple test for UI verification
      const timer = setTimeout(() => {
        console.log('🧪 FRONTEND: Creating new call entry after 5 seconds (fallback mode)');

        const newCallData = {
          id: Date.now(),
          date: new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\. /g, '-').replace('.', ''),
          callerName: '박지성',
          clientName: '(주)테크솔루션',
          phoneNumber: '02-8888-9999',
          recordingFileName: 'call_new_test.wav',
          transcriptFileName: 'transcript_new_test.txt',
          callDuration: '4:12'
        };

        handleCreateNewCall({ callData: newCallData });
      }, 5000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent, columnKey: CallColumnKey) => {
    e.preventDefault();
    setIsResizing(true);
    setResizingColumn(columnKey);

    const startX = e.clientX;
    const startWidth = columnWidths[columnKey];

    const handleMouseMove = (e: MouseEvent) => {
      const diffX = e.clientX - startX;
      const newWidth = Math.max(60, startWidth + diffX); // minimum 60px
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handlePlayRecording = async () => {
    console.log('🎵 Play button clicked!', { audioRef: !!audioRef.current, selectedCall: !!selectedCall, isPlaying });

    if (!audioRef.current || !selectedCall) {
      console.warn('🎵 Missing audioRef or selectedCall:', { audioRef: !!audioRef.current, selectedCall: !!selectedCall });
      return;
    }

    try {
      if (isPlaying) {
        console.log('🎵 Pausing audio...');
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        console.log('🎵 Starting audio playback...');
        console.log('🎵 Current audio src:', audioRef.current.src);

        // Always fetch file path to ensure we have the correct audio file
        console.log('🎵 Fetching file path for:', selectedCall.recordingFileName);

        // Check if getAudioFilePath method exists
        if (!window.electronAPI?.getAudioFilePath) {
          console.error('❌ getAudioFilePath method not available in electronAPI');
          return;
        }

        // Get file path from main process
        const filePath = await window.electronAPI.getAudioFilePath(selectedCall.recordingFileName);
        console.log('🎵 Received file path:', filePath);

        if (filePath) {
          const fileUrl = `file://${filePath}`;
          console.log('🎵 Setting audio source to:', fileUrl);
          audioRef.current.src = fileUrl;

          // Setup event listeners for this audio element
          setupAudioEventListeners(audioRef.current);

          // Wait for the audio to load before attempting to play
          console.log('🎵 Waiting for audio to load...');
          await new Promise((resolve, reject) => {
            const handleCanPlay = () => {
              console.log('🎵 Audio can play, proceeding...');
              audioRef.current!.removeEventListener('canplay', handleCanPlay);
              audioRef.current!.removeEventListener('error', handleError);
              resolve(void 0);
            };

            const handleError = (e: Event) => {
              console.error('❌ Audio loading error:', e);
              audioRef.current!.removeEventListener('canplay', handleCanPlay);
              audioRef.current!.removeEventListener('error', handleError);
              reject(e);
            };

            audioRef.current!.addEventListener('canplay', handleCanPlay);
            audioRef.current!.addEventListener('error', handleError);

            // Start loading
            audioRef.current!.load();
          });
        } else {
          console.error('❌ Audio file not found:', selectedCall.recordingFileName);
          return;
        }

        console.log('🎵 Attempting to play audio...');
        await audioRef.current.play();
        console.log('✅ Audio playback started successfully');
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const handleOpenTranscript = () => {
    if (!selectedCall) return;

    // For now, we'll get transcript from the call object
    // In the future, this could fetch from file or API
    const transcript = selectedCall.transcript || '음성 인식 처리 중입니다...';

    setCurrentTranscript(transcript);
    setIsTranscriptModalOpen(true);
    console.log(`Opening transcript for call: ${selectedCall.id}`);
  };

  const handleCandidateTaskCellEdit = (taskKey: string | number, columnKey: string, newValue: any) => {
    // Update local candidate task state (not saved to DB)
    setCandidateTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskKey ? { ...task, [columnKey]: newValue } : task
      )
    );

    // Update selected candidate task if it's the one being edited
    if (selectedCandidateTask?.id === taskKey) {
      setSelectedCandidateTask(prev => prev ? { ...prev, [columnKey]: newValue } : prev);
    }
  };

  const handleTaskToggle = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedTasks(candidateTasks.map(task => task.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const handleSubmitTasks = async () => {
    console.log('Converting selected tasks to real tasks:', selectedTasks);

    try {
      // Filter selected candidate tasks
      const tasksToConvert = candidateTasks.filter(task => selectedTasks.includes(task.id));

      // Create actual tasks in DB
      for (const candidateTask of tasksToConvert) {
        await window.electronAPI.createTask({
          title: candidateTask.title,
          description: '',
          status: 'pending',
          priority: 'medium',
          assignee: candidateTask.assignee,
          startDate: candidateTask.startDate,
          dueDate: candidateTask.dueDate,
          category: '',
          tags: '',
          client: '',
          hours: 0
        });
      }

      alert(`${selectedTasks.length}개의 업무를 업무 탭으로 변환했습니다.`);
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to convert tasks:', error);
      alert('업무 변환에 실패했습니다.');
    }
  };

  // Custom cell dropdown component for assignee (for candidate tasks)
  const AssigneeCell = ({ value, onChange, item }: { value: string, onChange: (newValue: string) => void, item: CandidateTask }) => {
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
          const rect = cellElement.getBoundingClientRect();
          setPosition({
            top: rect.bottom,
            left: rect.left
          });
          setIsOpen(true);
        };

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

  // Convert time string to seconds for progress calculation
  const parseTimeToSeconds = (timeStr: string) => {
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  const getTotalDuration = () => {
    return duration > 0 ? duration : (selectedCall ? parseTimeToSeconds(selectedCall.callDuration) : 0);
  };

  // Audio event handlers - attach them when audio element is ready
  const setupAudioEventListeners = (audio: HTMLAudioElement) => {
    console.log('🎵 Setting up audio event listeners');

    const handleTimeUpdate = () => {
      console.log('🎵 Time update:', audio.currentTime, 'of', audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      console.log('🎵 Audio metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      console.log('🎵 Audio playback ended');
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      console.error('❌ Audio error:', e);
      console.error('❌ Audio error details:', (e.target as HTMLAudioElement)?.error);
      setIsPlaying(false);
    };

    const handlePlay = () => {
      console.log('🎵 Audio play event fired');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('🎵 Audio pause event fired');
      setIsPlaying(false);
    };

    // Remove any existing listeners first
    audio.removeEventListener('timeupdate', handleTimeUpdate);
    audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    audio.removeEventListener('ended', handleEnded);
    audio.removeEventListener('error', handleError);
    audio.removeEventListener('play', handlePlay);
    audio.removeEventListener('pause', handlePause);

    // Add new listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    console.log('🎵 Audio event listeners attached');
  };

  // Load messages when selected call changes
  useEffect(() => {
    const loadMessagesForCall = async () => {
      if (!selectedCall) {
        setCallConversationsState({});
        setCandidateTasks([]);
        return;
      }

      try {
        console.log(`📥 FRONTEND: Loading messages for call ${selectedCall.id}`);
        const messages = await window.electronAPI.getMessagesByContext({ callId: selectedCall.id });
        console.log(`📥 FRONTEND: Loaded ${messages.length} messages for call ${selectedCall.id}`, messages);

        // Transform database messages to UI format
        const uiMessages = messages.map((msg: any) => {
          const metadata = msg.metadata ? JSON.parse(msg.metadata) : null;
          const hasCandidateTasks = metadata?.candidateTasks && metadata.candidateTasks.length > 0;

          // If this message has candidate tasks, set them in state
          if (hasCandidateTasks) {
            console.log(`📋 FRONTEND: Found ${metadata.candidateTasks.length} candidate tasks in message ${msg.id}`);
            setCandidateTasks(metadata.candidateTasks);
          }

          return {
            id: msg.id,
            author: msg.user.name,
            timestamp: new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            content: msg.content,
            type: msg.user.role === 'taxia' ? 'taxia' : 'user',
            hasCandidateTasks
          };
        });

        setCallConversationsState({
          [selectedCall.id]: uiMessages
        });

        console.log(`✅ FRONTEND: Messages loaded and set for call ${selectedCall.id}`);
      } catch (error) {
        console.error(`❌ FRONTEND: Failed to load messages for call ${selectedCall.id}:`, error);
      }
    };

    loadMessagesForCall();
  }, [selectedCall]);

  // Reset audio when selected call changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [selectedCall]);

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width;
    const newTime = clickRatio * getTotalDuration();

    console.log('🎵 Progress bar clicked:', { clickRatio, newTime, totalDuration: getTotalDuration() });

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Google Drive event handlers
  const handleFileDetected = (fileInfo: any) => {
    console.log('📁 File detected in UI:', fileInfo);

    // Add immediate message to most recent call (simulating current call being recorded)
    const callId = selectedCall?.id || 1;
    addMessageToCall(callId, {
      id: Date.now(),
      author: 'Taxia',
      timestamp: new Date().toLocaleTimeString(),
      content: `🎵 새로운 음성 파일을 감지했습니다: ${fileInfo.fileName}`,
      type: 'taxia'
    });
  };

  const handleCreateNewCall = (data: any) => {
    console.log('🎯 FRONTEND: Received create-new-call event:', data);

    // Add new call to the data table
    const newCall = data.callData;
    console.log('🎯 FRONTEND: Adding new call to data table:', newCall);
    setCalls(prevData => {
      const updated = [newCall, ...prevData];
      console.log('🎯 FRONTEND: Updated call data:', updated);
      return updated;
    });

    // Select the new call automatically
    console.log('🎯 FRONTEND: Selecting new call automatically');
    setSelectedCall(newCall);

    // Initialize empty messages array for this call
    setCallConversationsState(prevMessages => {
      const updated = {
        ...prevMessages,
        [newCall.id]: []
      };
      console.log('🎯 FRONTEND: Initialized empty messages for new call:', updated);
      return updated;
    });
    console.log('🎯 FRONTEND: handleCreateNewCall completed');
  };

  const handleConversationMessage = (data: any) => {
    console.log('💬 Taxia notification received:', data);
    // Add Taxia notification message to the most recent call (first in array)
    setCalls(prevData => {
      if (prevData && prevData.length > 0 && prevData[0]) {
        const recentCallId = prevData[0].id;
        addMessageToCall(recentCallId, {
          id: Date.now() + data.messageIndex,
          author: 'Taxia',
          timestamp: new Date().toLocaleTimeString(),
          content: data.message.content,
          type: 'taxia'
        });
      } else {
        console.warn('⚠️  No calls available to add message to');
      }
      return prevData;
    });
  };

  const handleFileProcessed = (data: any) => {
    console.log('📝 File processed in UI:', data);

    // Add transcription message
    const callId = selectedCall?.id || 1;
    addMessageToCall(callId, {
      id: Date.now() + 1,
      author: 'Taxia',
      timestamp: new Date().toLocaleTimeString(),
      content: `📝 음성을 텍스트로 변환했습니다 (정확도: ${data.accuracy}%): "${data.content}"`,
      type: 'taxia'
    });
  };

  const handleTasksExtracted = (data: any) => {
    console.log('✅ FRONTEND: Tasks extracted event received:', data);
    const { callId, message, timestamp } = data;

    // Set candidate tasks from the message
    if (message.candidateTasks && message.candidateTasks.length > 0) {
      console.log(`✅ FRONTEND: Setting ${message.candidateTasks.length} candidate tasks for call ${callId}`);
      setCandidateTasks(message.candidateTasks);

      // Add message to call conversation with hasCandidateTasks flag
      addMessageToCall(callId, {
        id: message.id,
        author: 'Taxia',
        timestamp: new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        content: message.content,
        type: 'taxia',
        hasCandidateTasks: true
      });

      console.log(`✅ FRONTEND: Added message with candidate tasks to call ${callId}`);
    } else {
      console.log(`📝 FRONTEND: No tasks extracted for call ${callId}, adding message only`);

      // Add message without tasks
      addMessageToCall(callId, {
        id: message.id,
        author: 'Taxia',
        timestamp: new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        content: message.content,
        type: 'taxia',
        hasCandidateTasks: false
      });
    }
  };

  const handleTranscriptUpdated = (data: any) => {
    console.log('📝 Transcript updated for call:', data);
    const { callId, transcript } = data;

    // Update the call in the state with the new transcript
    setCalls(prevCalls =>
      prevCalls.map(call =>
        call.id === callId
          ? { ...call, transcript }
          : call
      )
    );

    // If the updated call is currently selected, update the current transcript state
    if (selectedCall && selectedCall.id === callId) {
      setSelectedCall(prev => prev ? { ...prev, transcript } : prev);
      // If the modal is open, update the displayed transcript
      if (isTranscriptModalOpen) {
        setCurrentTranscript(transcript);
      }
    }

    console.log(`✅ FRONTEND: Updated transcript for call ${callId}`);
  };

  const addMessageToCall = (callId: string, message: any) => {
    setCallConversationsState(prev => ({
      ...prev,
      [callId]: [...(prev[callId] || []), message]
    }));
  };

  return (
    <div className="h-full w-full overflow-x-hidden">
      <PanelGroup direction="horizontal">
        {/* Left Panel - Call History List */}
        <Panel defaultSize={70} minSize={40}>
          <div className="h-full bg-white border-r border-gray-200 rounded-tl-lg rounded-bl-lg overflow-hidden flex flex-col">
            <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
              <h2 className="text-xl font-semibold text-gray-800">통화 목록</h2>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500">로딩 중...</div>
              </div>
            ) : (
              <ResizableTable
                columns={callColumns}
                data={calls}
                selectedItem={selectedCall}
                onItemSelect={setSelectedCall}
                getItemKey={(call) => call.id}
                emptyStateText="등록된 통화가 없습니다."
              />
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-0.5 bg-gray-300" />

        {/* Right Panel Group - Split vertically */}
        <Panel defaultSize={60} minSize={25}>
          <PanelGroup direction="vertical">
            {/* Top Right Panel - Call Details */}
            <Panel defaultSize={17.5} minSize={10}>
              <div className="h-full bg-white rounded-tr-lg overflow-hidden flex flex-col">
                <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
                  <h3 className="text-xl font-semibold text-gray-800">녹음</h3>
                </div>
                {selectedCall ? (
                  <div className="p-4 flex-shrink-0">
                    <div>
                      {/* Audio Player Section */}
                      <div>
                        <div>
                          {/* Fully Rounded Audio Player */}
                          <div className="bg-gray-100 rounded-full px-4 py-3 flex items-center">
                            {/* Play/Pause Button */}
                            <button
                              onClick={handlePlayRecording}
                              className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 transition-colors shadow-sm cursor-pointer"
                            >
                              {isPlaying ? (
                                <PauseIconSolid className="w-4 h-4" />
                              ) : (
                                <PlayIconSolid className="w-4 h-4 ml-0.5" />
                              )}
                            </button>

                            {/* Current Time */}
                            <span className="text-xs text-gray-600 font-medium min-w-[35px] ml-3 text-right">
                              {formatTime(currentTime)}
                            </span>

                            {/* Progress Bar */}
                            <div className="flex-1 relative mx-3">
                              <div
                                className="w-full bg-gray-300 rounded-full h-1 relative cursor-pointer"
                                onClick={handleProgressClick}
                              >
                                <div
                                  className="bg-gray-600 h-1 rounded-full transition-all duration-100"
                                  style={{
                                    width: `${(() => {
                                      const totalDuration = getTotalDuration();
                                      const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
                                      console.log('🎵 Progress bar render:', { currentTime, totalDuration, progressPercent });
                                      return progressPercent;
                                    })()}%`
                                  }}
                                ></div>
                              </div>
                            </div>

                            {/* Total Duration */}
                            <span className="text-xs text-gray-600 font-medium min-w-[35px] mr-3">
                              {formatTime(getTotalDuration())}
                            </span>

                            {/* Text File Icon */}
                            <button
                              onClick={handleOpenTranscript}
                              className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 transition-colors shadow-sm cursor-pointer"
                              title="텍스트 파일 열기"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Hidden Audio Element */}
                        <audio
                          ref={audioRef}
                          preload="metadata"
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    통화를 선택해주세요.
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="h-0.5 bg-gray-300" />

            {/* Bottom Right Panel - Call Thread */}
            <Panel defaultSize={82.5} minSize={30}>
              <div className="h-full bg-white rounded-br-lg overflow-hidden flex flex-col">
                <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
                  <h3 className="text-xl font-semibold text-gray-800">스레드</h3>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
                  {(callConversationsState[selectedCall?.id] || []).map((message) => (
                    <div key={message.id} className="flex gap-3 py-3 px-4 hover:bg-gray-50 min-w-0">
                      <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0">
                        <img
                          src="./assets/images/taxia-profile.png"
                          alt="Taxia"
                          className="w-9 h-9 rounded object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div
                          className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center text-white text-sm font-semibold"
                          style={{ display: 'none' }}
                        >
                          T
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 overflow-x-hidden">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{message.author}</span>
                          <span className="text-xs text-gray-500">{message.timestamp}</span>
                        </div>
                        <div className="text-sm text-gray-900">
                          {message.content}
                        </div>

                        {/* Task extraction section */}
                        {message.hasCandidateTasks && candidateTasks.length > 0 && (
                          <div className="mt-3 space-y-3">
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '300px' }}>
                                <ResizableTable
                                  columns={candidateTaskColumns}
                                  data={candidateTasks}
                                  selectedItem={selectedCandidateTask}
                                  onItemSelect={setSelectedCandidateTask}
                                  getItemKey={(task) => task.id}
                                  emptyStateText="추출된 업무가 없습니다."
                                  onCellEdit={handleCandidateTaskCellEdit}
                                  checkboxes={true}
                                  selectedCheckboxes={selectedTasks}
                                  onCheckboxToggle={handleTaskToggle}
                                  onSelectAll={handleSelectAll}
                                />
                              </div>
                            </div>

                            <button
                              onClick={handleSubmitTasks}
                              disabled={selectedTasks.length === 0}
                              className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              등록 ({selectedTasks.length})
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Show message when no conversations */}
                  {!selectedCall ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                      통화를 선택해주세요.
                    </div>
                  ) : (!callConversationsState[selectedCall?.id] || callConversationsState[selectedCall?.id].length === 0) && (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                      메시지가 없습니다.
                    </div>
                  )}
                </div>

                {/* Message input */}
                <MessageInput
                  onSendMessage={(message) => {
                    // TODO: Handle send message
                    console.log('Message sent:', message);
                  }}
                  placeholder="메시지를 입력하세요..."
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Transcript Modal */}
      <Dialog open={isTranscriptModalOpen} onOpenChange={setIsTranscriptModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] bg-white border-gray-200 flex flex-col">
          <DialogHeader className="text-left">
            <DialogTitle className="text-left">통화 텍스트</DialogTitle>
            <DialogDescription className="text-left">
              {selectedCall ? `${selectedCall.callerName} - ${selectedCall.date}` : '통화 정보'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
              {currentTranscript}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallsTab;