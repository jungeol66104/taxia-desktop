import React, { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ResizableTable } from '../shared';
import { Column, User } from '../../../shared/types';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { getRoleDisplayName, USER_ROLES } from '../../../shared/constants/roles';

type SettingsSection = 'profile' | 'server' | 'users';

const SettingsTab = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isServerMode, setIsServerMode] = useState(true);
  const [downloadLocation, setDownloadLocation] = useState('');
  const [defaultDownloadLocation, setDefaultDownloadLocation] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [tpRecordingEnabled, setTpRecordingEnabled] = useState(false);
  const [localServerUrl, setLocalServerUrl] = useState('http://localhost:3000');
  const [clientServerUrl, setClientServerUrl] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Local folder watcher states
  const [watchedFolderPath, setWatchedFolderPath] = useState('');
  const [isWatchingFolder, setIsWatchingFolder] = useState(false);

  // OpenAI API Key state
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  // Debounce timer for auto-save
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load users and default paths on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [usersData, defaultPath, tpEnabled, folderWatcherStatus, savedOpenaiKey, savedWatchedFolderPath] = await Promise.all([
          window.electronAPI.getAllHumanUsers(),
          window.electronAPI.getDefaultDownloadPath(),
          window.electronAPI.getSetting('tpRecordingEnabled'),
          window.electronAPI.folderWatcher.getStatus(),
          window.electronAPI.getSetting('openai_api_key'),
          window.electronAPI.getSetting('watchedFolderPath')
        ]);
        setUsers(usersData);
        setSelectedUser(usersData[0] || null);

        // Set default download location
        if (defaultPath) {
          setDefaultDownloadLocation(defaultPath);
          setDownloadLocation(defaultPath); // Initialize with default
        }

        // Set TP recording enabled state
        setTpRecordingEnabled(tpEnabled === 'true');

        // Set folder watcher status - prefer saved path from database
        if (folderWatcherStatus) {
          setIsWatchingFolder(folderWatcherStatus.isWatching || false);
          // Use saved path from database if available, otherwise use current watching path
          const folderPath = savedWatchedFolderPath || folderWatcherStatus.watchedFolder || '';
          setWatchedFolderPath(folderPath);
          console.log('📂 Loaded watched folder path:', folderPath);
        }

        // Fetch local server URL
        const localUrl = await window.electronAPI.getLocalUrl();
        if (localUrl) {
          setLocalServerUrl(localUrl);
        }

        // Set OpenAI API key
        if (savedOpenaiKey) {
          setOpenaiApiKey(savedOpenaiKey);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        // Fallback to a basic default if API fails
        const fallbackPath = '~/Documents/Taxia/call-recordings';
        setDefaultDownloadLocation(fallbackPath);
        setDownloadLocation(fallbackPath);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Load current user profile data
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        console.log('🔧 PROFILE: Loading current user...');
        let user = await window.electronAPI.getCurrentUser();
        console.log('🔧 PROFILE: getCurrentUser result:', user);

        if (!user) {
          console.log('🔧 PROFILE: getCurrentUser returned null, trying fallbacks...');
          // Try to get user from the session or any available user
          const allUsers = await window.electronAPI.getAllUsers();
          console.log('🔧 PROFILE: All users:', allUsers);

          // Prefer the current logged-in user if available
          user = allUsers.find(u => u.role === 'user') || allUsers[0];
          console.log('🔧 PROFILE: Selected fallback user:', user);
        }

        if (user) {
          console.log('🔧 PROFILE: Setting user data:', user);
          setCurrentUser(user);
          setProfileName(user.name || '');
          setProfileEmail(user.email || '');
        } else {
          console.warn('🔧 PROFILE: No user found!');
        }
      } catch (error) {
        console.error('Failed to load current user:', error);
      }
    };

    loadCurrentUser();
  }, []);

  const handleCellEdit = async (userKey: string | number, columnKey: string, newValue: any) => {
    // For now, just update local state since we don't have updateUser API
    try {
      const userToUpdate = users.find(user => user.id === userKey);
      if (!userToUpdate) return;

      const updatedUser = {
        ...userToUpdate,
        [columnKey]: newValue
      };

      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userKey ? updatedUser : user
        )
      );

      // Update selected user if it's the one being edited
      if (selectedUser?.id === userKey) {
        setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('사용자 정보 업데이트에 실패했습니다.');
    }
  };

  const handleUserDelete = async (user: User) => {
    if (window.confirm(`"${user.name}" 사용자를 삭제하시겠습니까?`)) {
      // For now, just remove from local state since we don't have deleteUser API
      setUsers(users.filter(u => u.id !== user.id));

      // Clear selection if deleted user was selected
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.selectFolder();
      if (selectedPath) {
        setDownloadLocation(selectedPath);
        await window.electronAPI.setDownloadPath(selectedPath);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleResetToDefault = async () => {
    setDownloadLocation(defaultDownloadLocation);
    await window.electronAPI.setDownloadPath(defaultDownloadLocation);
  };

  const handleProfileNameChange = async (newName: string) => {
    setProfileName(newName);

    // Update database in real-time
    if (currentUser) {
      try {
        const updatedUser = await window.electronAPI.updateUser(currentUser.id, { name: newName });
        setCurrentUser(updatedUser);
      } catch (error) {
        console.error('Failed to update profile name:', error);
        // Revert the change on error
        setProfileName(currentUser.name || '');
      }
    }
  };

  const handleProfileEmailChange = async (newEmail: string) => {
    setProfileEmail(newEmail);

    // Update database in real-time
    if (currentUser) {
      try {
        const updatedUser = await window.electronAPI.updateUser(currentUser.id, { email: newEmail });
        setCurrentUser(updatedUser);
      } catch (error) {
        console.error('Failed to update profile email:', error);
        // Revert the change on error
        setProfileEmail(currentUser.email || '');
      }
    }
  };

  const handleFactoryReset = async () => {
    try {
      const result = await window.electronAPI.factoryReset();

      if (result.cancelled) {
        console.log('Factory reset cancelled by user');
        return;
      }

      if (result.success) {
        // App will relaunch automatically
        console.log('✅ Factory reset completed, app will relaunch');
      } else {
        console.error('❌ Factory reset failed:', result.error);
        alert('초기화에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Factory reset error:', error);
      alert('초기화 중 오류가 발생했습니다.');
    }
  };

  const handleSelectFolder = async () => {
    try {
      console.log('📁 Opening folder selector...');
      const result = await window.electronAPI.folderWatcher.selectFolder();

      if (result.success && result.folderPath) {
        setWatchedFolderPath(result.folderPath);
        // Save folder path to database for persistence
        await window.electronAPI.setSetting('watchedFolderPath', result.folderPath);
        console.log('✅ Folder selected and saved:', result.folderPath);
      } else if (!result.cancelled) {
        console.error('❌ Failed to select folder:', result.error);
        alert('폴더 선택 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('❌ Select folder error:', error);
      alert('폴더 선택 중 오류가 발생했습니다.');
    }
  };

  const handleStartWatching = async () => {
    if (!watchedFolderPath) {
      alert('폴더를 먼저 선택해주세요.');
      return;
    }

    try {
      console.log('👀 Starting to watch folder:', watchedFolderPath);
      const result = await window.electronAPI.folderWatcher.start(watchedFolderPath);

      if (result.success) {
        setIsWatchingFolder(true);
        console.log('✅ Started watching folder');
        alert(`폴더 감시 시작: ${watchedFolderPath}`);
      } else {
        console.error('❌ Failed to start watching:', result.error);
        alert('폴더 감시 시작 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('❌ Start watching error:', error);
      alert('폴더 감시 시작 중 오류가 발생했습니다.');
    }
  };

  const handleStopWatching = async () => {
    if (!window.confirm('폴더 감시를 중지하시겠습니까?')) {
      return;
    }

    try {
      console.log('🛑 Stopping folder watch...');
      const result = await window.electronAPI.folderWatcher.stop();

      if (result.success) {
        setIsWatchingFolder(false);
        // Keep the folder path in UI but clear the watching state in database
        // User can restart watching without re-selecting
        console.log('✅ Stopped watching folder');
        alert('폴더 감시가 중지되었습니다.');
      } else {
        console.error('❌ Failed to stop watching:', result.error);
        alert('폴더 감시 중지 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('❌ Stop watching error:', error);
      alert('폴더 감시 중지 중 오류가 발생했습니다.');
    }
  };

  const handleTpRecordingToggle = async (enabled: boolean) => {
    setTpRecordingEnabled(enabled);

    // Save to database
    try {
      await window.electronAPI.setSetting('tpRecordingEnabled', enabled.toString());
      console.log('✅ TP recording enabled state saved:', enabled);

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('tpRecordingChanged', { detail: { enabled } }));
    } catch (error) {
      console.error('Failed to save TP recording enabled state:', error);
    }
  };

  const handleOpenaiApiKeyChange = async (newKey: string) => {
    setOpenaiApiKey(newKey);

    // Save to database
    try {
      await window.electronAPI.setSetting('openai_api_key', newKey);
      console.log('✅ OpenAI API key saved');
    } catch (error) {
      console.error('Failed to save OpenAI API key:', error);
    }
  };

  const userColumns: Column[] = [
    { key: 'name', label: '이름', width: 120, editable: true },
    { key: 'email', label: '이메일', width: 250, editable: true },
    {
      key: 'role',
      label: '역할',
      width: 100,
      editable: true,
      render: (value: string) => getRoleDisplayName(value)
    },
    ...(tpRecordingEnabled ? [
      { key: 'tpCode', label: 'TP 코드', width: 100, editable: true }
    ] : [])
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-8 pb-8">
            {/* My Account Section */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">내 계정</h3>
              <div className="border-b border-gray-200 mb-4"></div>
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">이름</Label>
                    <p className="text-xs text-gray-500 mt-1">프로필에 표시될 사용자 이름입니다.</p>
                    <div className="mt-2">
                      <Input
                        type="text"
                        value={profileName}
                        onChange={(e) => handleProfileNameChange(e.target.value)}
                        placeholder="사용자 이름을 입력하세요"
                        className="max-w-md"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">이메일</Label>
                    <p className="text-xs text-gray-500 mt-1">로그인 및 알림을 받을 이메일 주소입니다.</p>
                    <div className="mt-2">
                      <Input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => handleProfileEmailChange(e.target.value)}
                        placeholder="이메일 주소를 입력하세요"
                        className="max-w-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        );

      case 'server':
        return (
          <div className="space-y-8 pb-8">
            {/* Server Mode Section */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">서버 모드</h3>
              <div className="border-b border-gray-200 mb-4"></div>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">서버 모드 활성화</Label>
                    <p className="text-xs text-gray-500 mt-1">로컬 서버로 실행하여 다른 클라이언트의 연결을 받습니다</p>
                  </div>
                  <div className="ml-4">
                    <Switch
                      checked={isServerMode}
                      onCheckedChange={setIsServerMode}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Server Configuration Section */}
            {isServerMode && (
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">서버 설정</h3>
              <div className="border-b border-gray-200 mb-4"></div>
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">로컬 네트워크 URL</Label>
                    <p className="text-xs text-gray-500 mt-1">같은 사무실 네트워크의 직원들과 공유하세요 (WiFi/유선 모두 가능)</p>
                    <div className="mt-2 flex gap-2">
                      <Input
                        type="text"
                        value={localServerUrl}
                        readOnly
                        className="flex-1 bg-gray-50"
                        disabled={!isServerMode}
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(localServerUrl)}
                        disabled={!isServerMode}
                        className="flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        style={{ height: '32px', width: '32px', minWidth: '32px' }}
                        title="복사"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                {/* Remote Access - Coming Soon */}
                {/*
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">원격 접속</Label>
                    <p className="text-xs text-gray-500 mt-1">재택근무자도 연결할 수 있도록 인터넷 접속을 활성화합니다</p>
                  </div>
                  <div className="ml-4">
                    <Switch checked={false} disabled />
                  </div>
                </div>
                */}
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">TP 녹음 연동</Label>
                    <p className="text-xs text-gray-500 mt-1">로컬 폴더를 감시하여 통화 녹음을 자동으로 가져옵니다</p>
                  </div>
                  <div className="ml-4">
                    <Switch
                      checked={tpRecordingEnabled}
                      onCheckedChange={handleTpRecordingToggle}
                    />
                  </div>
                </div>
                {tpRecordingEnabled && (
                <>
                  {/* Local Folder Watching */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-gray-900">통화 녹음 폴더 감시</Label>
                      <p className="text-xs text-gray-500 mt-1">
                        TP에서 저장되는 녹음 파일 폴더를 선택하면, 새 파일이 추가될 때마다 자동으로 전사하고 업무를 추출합니다.
                      </p>
                      <div className="mt-2 flex space-x-2">
                        <Input
                          type="text"
                          value={watchedFolderPath}
                          placeholder="폴더를 선택하세요"
                          className="flex-1"
                          readOnly
                          disabled={!isServerMode}
                        />
                        <button
                          onClick={handleSelectFolder}
                          disabled={!isServerMode || isWatchingFolder}
                          className="h-8 w-8 flex items-center justify-center bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          title="폴더 선택"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                        {!isWatchingFolder ? (
                          <button
                            onClick={handleStartWatching}
                            disabled={!isServerMode || !watchedFolderPath}
                            className="h-8 w-8 flex items-center justify-center bg-green-600 text-white border border-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="감시 시작"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={handleStopWatching}
                            disabled={!isServerMode}
                            className="h-8 w-8 flex items-center justify-center bg-red-600 text-white border border-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="감시 중지"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* OpenAI API Key Input */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-gray-900">OpenAI API 키</Label>
                      <p className="text-xs text-gray-500 mt-1">통화 내용 자동 전사(STT)와 업무 추출을 위한 OpenAI API 키를 입력합니다 (선택사항)</p>
                      <div className="mt-2">
                        <Input
                          type="password"
                          value={openaiApiKey}
                          onChange={(e) => handleOpenaiApiKeyChange(e.target.value)}
                          placeholder="sk-..."
                          className="max-w-md"
                          disabled={!isServerMode}
                        />
                      </div>
                    </div>
                  </div>
                </>
                )}
              </div>
            </div>
            )}

            {/* Client Configuration Section */}
            {!isServerMode && (
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">클라이언트 설정</h3>
              <div className="border-b border-gray-200 mb-4"></div>
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">서버 주소</Label>
                    <p className="text-xs text-gray-500 mt-1">연결할 서버의 주소와 포트를 입력합니다.</p>
                    <div className="mt-2">
                      <Input
                        type="text"
                        value={clientServerUrl}
                        onChange={(e) => setClientServerUrl(e.target.value)}
                        placeholder="http://192.168.1.100:3000"
                        className="max-w-md"
                        disabled={isServerMode}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* App Reset Section - Always visible */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">앱 관리</h3>
              <div className="border-b border-gray-200 mb-4"></div>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-gray-900">앱 초기화</Label>
                    <p className="text-xs text-gray-500 mt-1">모든 데이터를 삭제하고 앱을 처음 상태로 되돌립니다. 이 작업은 되돌릴 수 없습니다.</p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={handleFactoryReset}
                      className="px-4 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors cursor-pointer"
                      style={{ height: '32px' }}
                    >
                      앱 초기화
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="h-full bg-white rounded-tr-lg rounded-br-lg overflow-hidden flex flex-col">
            <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0" style={{ height: '48px' }}>
              <h2 className="text-xl font-semibold text-gray-800">사용자 목록</h2>
              <button
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                onClick={async () => {
                  try {
                    const newUser = await window.electronAPI.createUser({
                      name: '',
                      email: '',
                      role: 'user'
                    });

                    // Add to local state and select
                    setUsers([newUser, ...users]);
                    setSelectedUser(newUser);

                    // Focus on first input
                    setTimeout(() => {
                      firstInputRef.current?.focus();
                    }, 0);
                  } catch (error) {
                    console.error('Failed to create user:', error);
                  }
                }}
                title="새 사용자 추가"
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
                columns={userColumns}
                data={users}
                selectedItem={selectedUser}
                onItemSelect={setSelectedUser}
                getItemKey={(user) => user.id}
                emptyStateText="등록된 사용자가 없습니다."
                onCellEdit={handleCellEdit}
                onItemDelete={handleUserDelete}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal">
        {/* Left Panel - Settings Navigation */}
        <Panel defaultSize={30} minSize={20} style={{ zIndex: 10 }}>
          <div className="h-full bg-white border-r border-gray-200 rounded-tl-lg rounded-bl-lg overflow-hidden flex flex-col">
            <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0" style={{ height: '48px' }}>
              <h2 className="text-xl font-semibold text-gray-800">설정</h2>
            </div>

            <div className="p-2">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`w-full text-left px-3 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    activeSection === 'profile'
                      ? 'bg-blue-50 text-black'
                      : 'text-black hover:bg-gray-100'
                  }`}
                  style={{ height: '28px' }}
                >
                  프로필
                </button>
                <button
                  onClick={() => setActiveSection('server')}
                  className={`w-full text-left px-3 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    activeSection === 'server'
                      ? 'bg-blue-50 text-black'
                      : 'text-black hover:bg-gray-100'
                  }`}
                  style={{ height: '28px' }}
                >
                  서버
                </button>
                <button
                  onClick={() => setActiveSection('users')}
                  className={`w-full text-left px-3 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    activeSection === 'users'
                      ? 'bg-blue-50 text-black'
                      : 'text-black hover:bg-gray-100'
                  }`}
                  style={{ height: '28px' }}
                >
                  유저
                </button>
              </nav>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle
          className="w-0.5 bg-gray-300"
          style={{ zIndex: 5 }}
        />

        {/* Right Panel - Settings Content */}
        <Panel defaultSize={70} minSize={40} style={{ zIndex: 10 }}>
          {activeSection === 'users' ? (
            renderContent()
          ) : (
            <div className="h-full bg-white rounded-tr-lg rounded-br-lg overflow-hidden flex flex-col">
              <div className="px-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0" style={{ height: '48px' }}>
                <h3 className="text-xl font-semibold text-gray-800">
                  {activeSection === 'profile' && '프로필'}
                  {activeSection === 'server' && '서버'}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto py-2 px-3">
                {renderContent()}
              </div>
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default SettingsTab;