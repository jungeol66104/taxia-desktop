import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  HomeIcon as HomeIconSolid,
  Square2StackIcon as Square2StackIconSolid,
  RectangleStackIcon as RectangleStackIconSolid,
  PhoneIcon as PhoneIconSolid
} from '@heroicons/react/24/solid';
import {
  HomeIcon as HomeIconOutline,
  Square2StackIcon as Square2StackIconOutline,
  RectangleStackIcon as RectangleStackIconOutline,
  PhoneIcon as PhoneIconOutline,
  Cog8ToothIcon
} from '@heroicons/react/24/outline';
import './index.css';
import { CallsTab, ClientsTab, TasksTab, SettingsTab } from './components';
import { TasksChart } from './components/TasksChart';
import LoginScreen from './components/auth/LoginScreen';
import SetupWizard from './components/setup/SetupWizard';
// import { WebhookStatusNotification } from './components/shared';
import { ElectronAPI } from '../shared/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import taxiaProfileImage from './assets/images/taxia-profile.png';

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Utility function to generate avatar background color from email
const getAvatarColor = (email: string): string => {
  const colors = [
    '#2E7D32', // Deep green
    '#7B1FA2', // Deep purple
    '#C62828', // Deep red
    '#E65100', // Deep orange
    '#5D4037', // Deep brown
    '#455A64', // Blue grey
    '#6A1B9A'  // Deep violet
  ];

  const firstChar = email.charAt(0).toLowerCase();
  const colorIndex = firstChar.charCodeAt(0) % colors.length;
  return colors[colorIndex];
};

// Main App Component (the existing main interface)
const MainApp = ({ onLogout, userData }: { onLogout?: () => void; userData?: any }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [tpRecordingEnabled, setTpRecordingEnabled] = useState(false);

  // Load TP recording enabled state
  React.useEffect(() => {
    const loadTpSettings = async () => {
      try {
        const tpEnabled = await window.electronAPI?.getSetting?.('tpRecordingEnabled');
        setTpRecordingEnabled(tpEnabled === 'true');
      } catch (error) {
        console.error('Failed to load TP recording settings:', error);
      }
    };
    loadTpSettings();

    // Listen for TP recording setting changes
    const handleTpRecordingChanged = (event: CustomEvent) => {
      setTpRecordingEnabled(event.detail.enabled);
    };
    window.addEventListener('tpRecordingChanged', handleTpRecordingChanged as EventListener);

    return () => {
      window.removeEventListener('tpRecordingChanged', handleTpRecordingChanged as EventListener);
    };
  }, []);

  const allTabs = [
    {
      id: 'home',
      label: '홈',
      iconSolid: HomeIconSolid,
      iconOutline: HomeIconOutline,
      visible: true
    },
    {
      id: 'work',
      label: '업무',
      iconSolid: Square2StackIconSolid,
      iconOutline: Square2StackIconOutline,
      visible: true
    },
    {
      id: 'clients',
      label: '수임처',
      iconSolid: RectangleStackIconSolid,
      iconOutline: RectangleStackIconOutline,
      visible: true
    },
    {
      id: 'calls',
      label: 'TP 녹음',
      iconSolid: PhoneIconSolid,
      iconOutline: PhoneIconOutline,
      visible: tpRecordingEnabled
    },
  ];

  const tabs = allTabs.filter(tab => tab.visible);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        const now = new Date();
        const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const dayName = days[now.getDay()];
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const userName = userData?.name || '사용자';

        return (
          <div className="h-full flex flex-col overflow-y-auto">
            <div className="p-6">
              <p className="text-gray-500 text-sm" style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
                {month}월 {date}일 {dayName}
              </p>
              <h1 style={{ margin: '0 0 24px 0', fontSize: '32px', fontWeight: '500' }} className="text-gray-800">
                안녕하세요, {userName}님
              </h1>

              <TasksChart />
            </div>
          </div>
        );
      case 'work':
        return <TasksTab key="work-tab" isActive={activeTab === 'work'} />;
      case 'clients':
        return <ClientsTab />;
      case 'calls':
        return <CallsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <div style={{ padding: '12px' }}><p className="text-gray-800" style={{ paddingLeft: '16px', margin: '0', padding: '0' }}>홈 화면입니다.</p></div>;
    }
  };

  return (
    <div
      className="w-full h-screen flex flex-col"
      style={{
        background: 'linear-gradient(136.53deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.2) 100%), linear-gradient(312.01deg, #004492 0%, rgba(0,68,146,0.75) 100%)',
        backgroundColor: '#004492'
      }}
    >
      {/* Native Title Bar Area - exactly 40px height */}
      <div
        className="w-full flex-shrink-0 flex items-center justify-end"
        style={{
          height: '40px',
          WebkitAppRegion: 'drag',
          backgroundColor: 'transparent'
        }}
      >
        {/* Button Group */}
        <div
          className="flex items-center"
          style={{
            margin: '8px',
            WebkitAppRegion: 'no-drag',
            gap: '6px'
          }}
        >
          {/* Profile Button */}
          <button
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            title="Profile"
          >
            {/* Taxia Profile Image */}
            <img
              src={taxiaProfileImage}
              alt="Taxia Profile"
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                objectFit: 'cover'
              }}
              onError={(e) => {
                // Fallback if image doesn't load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling && ((target.nextElementSibling as HTMLElement).style.display = 'flex');
              }}
            />
            {/* Fallback */}
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#004492',
                fontWeight: 'bold'
              }}
            >
              T
            </div>
          </button>


          {/* Settings Button */}
          <button
            onClick={() => setActiveTab('settings')}
            onMouseEnter={(e) => {
              if (activeTab !== 'settings') {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'settings') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: activeTab === 'settings' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            title="Settings"
          >
            <Cog8ToothIcon
              style={{
                width: '20px',
                height: '20px',
                minWidth: '20px',
                minHeight: '20px',
                flexShrink: 0,
                color: activeTab === 'settings' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'
              }}
            />
          </button>
        </div>
      </div>

      {/* Main Layout - Sidebar + Content */}
      <div className="flex-1 flex flex-row" style={{ minHeight: 0 }}>
        {/* Sidebar - Clean styling with 70px width */}
        <div
          className="flex-shrink-0 flex flex-col justify-between"
          style={{
            width: '70px',
            backgroundColor: 'transparent',
            border: 'none'
          }}
        >
          {/* Top Section - Favicon + Tabs */}
          <div className="flex flex-col items-center w-full">
            {/* Favicon */}
            <div className="flex justify-center w-full" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
              <img
                src=""
                alt="Peacetax"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  objectFit: 'contain',
                  border: '1px solid rgba(237, 237, 237, 0.3)',
                  display: 'none'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(237, 237, 237, 0.3)',
                  border: '1px solid rgba(237, 237, 237, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                P
              </div>
            </div>

            {/* Sidebar Tabs - Centered 52px width container */}
            <div className="flex flex-col" style={{ width: '52px' }}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = isActive ? tab.iconSolid : tab.iconOutline;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="group relative flex flex-col items-center justify-center transition-all duration-200 focus:outline-none border-none"
                    style={{
                      width: '52px',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                    title={tab.label}
                  >
                    <div
                      className="transition-colors duration-200"
                      style={{
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                        borderRadius: '6px',
                      }}
                    >
                      <Icon
                        className="transition-colors duration-200"
                        style={{
                          width: '24px',
                          height: '24px',
                          color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                        }}
                      />
                    </div>
                    <span
                      className="transition-colors duration-200 font-medium"
                      style={{
                        color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '11px',
                        marginTop: '6px',
                        lineHeight: '1',
                        fontWeight: isActive ? 'bold' : 'medium'
                      }}
                    >
                      {tab.label}
                    </span>

                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Section - User Icon */}
          <div className="flex justify-center w-full" style={{ paddingBottom: '16px' }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    outline: 'none'
                  }}
                  className="focus:outline-none focus:ring-0"
                  title={userData?.email || 'User Profile'}
                >
                  {userData?.avatar ? (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img
                        src={userData.avatar}
                        alt="User Profile"
                        style={{
                          width: '36px',
                          height: '36px',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.parentElement?.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    </div>
                  ) : null}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      backgroundColor: userData?.email ? getAvatarColor(userData.email) : '#6B7280',
                      display: userData?.avatar ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      color: 'white',
                      fontWeight: '400',
                      textTransform: 'uppercase'
                    }}
                  >
                    {userData?.name ? userData.name.charAt(0) : userData?.email ? userData.email.charAt(0) : 'U'}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="bg-white">
                <DropdownMenuItem onClick={onLogout}>
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Display Section */}
        <div className="flex-1 flex" style={{ padding: '0 4px 4px 0', width: 'calc(100% - 70px)' }}>
          <div
            className="flex-1 w-full"
            style={{
              backgroundColor: '#ffffff',
              minHeight: '200px',
              borderRadius: '8px',
              border: '1px solid #ededed',
            }}
          >
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Webhook Status Notifications - Temporarily disabled for debugging */}
      {/* <WebhookStatusNotification /> */}
    </div>
  );
};

// Root App Component with routing logic
const App = () => {
  // Check URL parameters for mode
  const urlParams = new URLSearchParams(window.location.search);
  const isLoginMode = urlParams.get('mode') === 'login';
  const isSetupMode = urlParams.get('mode') === 'setup';

  // If we're in main mode, start as authenticated (login already happened in login window)
  const [isAuthenticated, setIsAuthenticated] = useState(!isLoginMode && !isSetupMode);
  const [userData, setUserData] = useState<any>(null);

  // Load user data on startup for main mode
  React.useEffect(() => {
    if (!isLoginMode && isAuthenticated && !userData) {
      const loadUserData = async () => {
        try {
          console.log('🔧 RENDERER: Loading user data...');
          // Get current user data from main process (stored during login)
          const user = await window.electronAPI?.getCurrentUser?.();
          console.log('🔧 RENDERER: Current user from main process:', user);

          if (user) {
            console.log('🔧 RENDERER: Setting user data:', user);
            setUserData(user);
          } else {
            console.warn('🔧 RENDERER: No current user data available');
            // Fallback to database query if main process doesn't have user data
            const allUsers = await window.electronAPI?.getAllUsers?.();
            // Prefer the current logged-in user (role 'user') over admin
            const fallbackUser = allUsers?.find(u => u.role === 'user') || allUsers?.[0];
            if (fallbackUser) {
              console.log('🔧 RENDERER: Using fallback user data:', fallbackUser);
              setUserData(fallbackUser);
            }
          }
        } catch (error) {
          console.warn('Could not load user data:', error);
        }
      };
      loadUserData();
    }
  }, [isLoginMode, isAuthenticated, userData]);

  const handleSetupComplete = async (data: any) => {
    console.log('Setup complete:', data);
    // Signal main process that setup is complete - it will transition to login window
    try {
      await window.electronAPI?.setupComplete?.();
    } catch (error) {
      console.error('Failed to signal setup completion:', error);
    }
  };

  const handleLogin = async (userData?: any) => {
    if (isLoginMode) {
      // In login mode, send IPC event to create main window
      window.electronAPI?.loginSuccess?.(userData || { user: 'temp' });
    } else {
      // In single-window mode, restore main window size and switch to main app
      try {
        await window.electronAPI?.restoreMainWindow?.();
      } catch (error) {
        console.error('Failed to restore main window:', error);
      }
      setIsAuthenticated(true);
      setUserData(userData);
    }
  };

  const handleLogout = async () => {
    try {
      // Call the main process to resize window to login size
      await window.electronAPI?.logout?.();

      // Update renderer state
      setIsAuthenticated(false);
      setUserData(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Still update renderer state even if IPC call fails
      setIsAuthenticated(false);
      setUserData(null);
    }
  };

  // If we're in setup mode, show setup wizard
  if (isSetupMode) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  // If we're in login mode, always show login screen
  if (isLoginMode) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // If we're in main mode, show main app directly (user already authenticated via login window)
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <MainApp onLogout={handleLogout} userData={userData} />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
