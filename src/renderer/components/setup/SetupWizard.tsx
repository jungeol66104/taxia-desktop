import React, { useState } from 'react';
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { USER_ROLES } from '../../../shared/constants/roles';

interface SetupWizardProps {
  onComplete: (userData: any) => void;
}

type AppMode = 'server' | 'client';

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<AppMode | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [adminData, setAdminData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [serverUrl, setServerUrl] = useState('');

  const handleModeSelect = (selectedMode: AppMode) => {
    setMode(selectedMode);
    setStep(2);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setError('');
      if (step === 2) {
        setMode(null);
      }
    }
  };

  const handleContinue = () => {
    setStep(step + 1);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return '비밀번호는 최소 8자 이상이어야 합니다';
    if (!/[A-Z]/.test(password)) return '비밀번호에 대문자가 포함되어야 합니다';
    if (!/[a-z]/.test(password)) return '비밀번호에 소문자가 포함되어야 합니다';
    if (!/[0-9]/.test(password)) return '비밀번호에 숫자가 포함되어야 합니다';
    return null;
  };

  // Server - Step 2: Company Name
  const handleServerStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim()) {
      setError('회사명을 입력하세요');
      return;
    }
    setStep(3); // Move to Admin Account
  };

  // Server - Step 3: Admin Account (complete setup here)
  const handleServerStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate password
      const passwordError = validatePassword(adminData.password);
      if (passwordError) {
        setError(passwordError);
        setIsLoading(false);
        return;
      }
      if (adminData.password !== adminData.confirmPassword) {
        setError('비밀번호가 일치하지 않습니다');
        setIsLoading(false);
        return;
      }

      // Create admin account
      const signupResult = await window.electronAPI.authSignup({
        name: adminData.name,
        email: adminData.email,
        password: adminData.password
      });

      console.log('🔍 [DEBUG] Signup result:', signupResult);

      if (!signupResult.success) {
        console.log('🔍 [DEBUG] Signup failed. Error:', signupResult.error);
        // If database error occurs, run diagnostics
        if (signupResult.error?.includes('Database service not available')) {
          console.log('🔍 Running database diagnostics...');
          const diagnostics = await window.electronAPI.checkDatabaseSetup();
          console.log('📊 Database diagnostics:', diagnostics);

          // Build detailed error message
          let detailedError = '데이터베이스 초기화 실패\n\n';
          if (diagnostics.success && diagnostics.diagnostics) {
            const d = diagnostics.diagnostics;
            detailedError += `시스템 정보:\n`;
            detailedError += `- Platform: ${d.platform} (${d.arch})\n`;
            detailedError += `- Resources Path: ${d.resourcesPath}\n\n`;
            detailedError += `검사 결과:\n`;
            d.checks.forEach((check: any, idx: number) => {
              detailedError += `${idx + 1}. ${check.name}: `;
              if (check.exists !== undefined) {
                detailedError += check.exists ? '✓ 존재함' : '✗ 없음';
                if (check.path) detailedError += `\n   경로: ${check.path}`;
              } else if (check.success !== undefined) {
                detailedError += check.success ? '✓ 성공' : '✗ 실패';
                if (check.error) detailedError += `\n   오류: ${check.error}`;
              }
              detailedError += '\n';
            });
          }

          throw new Error(detailedError);
        }
        throw new Error(signupResult.error || 'Failed to create admin account');
      }

      // Save company name
      await window.electronAPI.setCompanyName(companyName);

      console.log('✅ Setup completed - moving to summary');
      setStep(4); // Move to Summary
    } catch (error) {
      console.error('Server setup error:', error);
      setError(`설정 중 오류 발생:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Server - Step 4: Summary (complete)
  const handleServerSummaryComplete = () => {
    onComplete({ name: adminData.name, email: adminData.email });
  };

  // Client setup
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (!serverUrl.trim()) throw new Error('서버 URL을 입력하세요');
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(serverUrl)) {
        throw new Error('올바른 URL 형식이 아닙니다 (예: http://192.168.1.100:3000)');
      }
      onComplete({ mode: 'client', serverUrl });
    } catch (error) {
      console.error('Client setup error:', error);
      setError(`설정 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getSteps = () => {
    const baseSteps = [
      { id: 0, label: '소개', active: step === 0 },
      { id: 1, label: '모드 선택', active: step === 1 }
    ];
    if (mode === 'server') {
      return [
        ...baseSteps,
        { id: 2, label: '회사 정보', active: step === 2 },
        { id: 3, label: '관리자 계정', active: step === 3 },
        { id: 4, label: '완료', active: step === 4 }
      ];
    } else if (mode === 'client') {
      return [
        ...baseSteps,
        { id: 2, label: '서버 연결', active: step === 2 },
        { id: 3, label: '완료', active: step === 3 }
      ];
    }
    return baseSteps;
  };

  const steps = getSteps();

  return (
    <div
      className="w-full h-screen flex flex-col"
      style={{
        background: 'linear-gradient(136.53deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.2) 100%), linear-gradient(312.01deg, #004492 0%, rgba(0,68,146,0.75) 100%)',
        backgroundColor: '#004492'
      }}
    >
      {/* Native Title Bar Area */}
      <div style={{ height: '40px', WebkitAppRegion: 'drag' }} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col" style={{ padding: '0 4px 0 4px' }}>
        {/* Step Description - Above white card */}
        <div className="flex-shrink-0" style={{ paddingLeft: '184px', paddingRight: '4px', paddingTop: '12px', paddingBottom: '8px' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {step === 0 && '택시아 초기 설정을 시작합니다.'}
            {step === 1 && '서버 또는 클라이언트 모드를 선택하세요.'}
            {mode === 'server' && step === 2 && '세무 사무소 이름을 입력하세요.'}
            {mode === 'server' && step === 3 && '관리자 계정을 생성합니다.'}
            {mode === 'server' && step === 4 && '설정이 완료되었습니다.'}
            {mode === 'client' && step === 2 && '서버 주소를 입력하세요.'}
          </p>
        </div>

        {/* Content Row */}
        <div className="flex-1 flex gap-0">
          {/* Sidebar - Part of blue gradient background */}
          <div
            className="flex-shrink-0 flex flex-col justify-between p-4"
            style={{
              width: '180px',
              backgroundColor: 'transparent'
            }}
          >
            {/* Step Indicators */}
            <div className="space-y-1">
              {steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 py-0.5">
                  <div
                    className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: s.active ? 'white' : 'rgba(255,255,255,0.3)'
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{
                      color: s.active ? 'white' : 'rgba(255,255,255,0.6)',
                      fontWeight: s.active ? '600' : '400'
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* White Card Content Area */}
          <div
            className="flex-1 flex rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'white',
              border: '1px solid #ededed'
            }}
          >
            <div className="flex-1 flex flex-col">
              {/* Content */}
              <div className="flex-1 p-4 overflow-y-auto">
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div>
                  <p className="text-sm" style={{ color: '#5f6368' }}>
                    설정을 시작하려면 계속 버튼을 클릭하세요.
                  </p>
                </div>
              )}

              {/* Step 1: Mode Selection */}
              {step === 1 && (
                <div className="-m-4">
                  <div className="px-4 py-4" style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <p className="text-sm" style={{ color: '#5f6368' }}>
                      이 PC를 서버로 사용할지, 다른 서버에 연결하는 클라이언트로 사용할지 선택하세요.
                    </p>
                  </div>
                  <button
                    onClick={() => handleModeSelect('server')}
                    className="w-full px-4 py-3 transition-all hover:bg-blue-50 text-left flex items-center gap-3 cursor-pointer"
                    style={{ borderBottom: '1px solid #e0e0e0' }}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004492" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                        <line x1="6" y1="6" x2="6.01" y2="6"/>
                        <line x1="6" y1="18" x2="6.01" y2="18"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium mb-0.5" style={{ color: '#1f1f1f' }}>
                        서버 모드
                      </h3>
                      <p className="text-xs" style={{ color: '#5f6368' }}>
                        데이터베이스를 관리하는 메인 서버로 설정합니다.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleModeSelect('client')}
                    className="w-full px-4 py-3 transition-all hover:bg-blue-50 text-left flex items-center gap-3 cursor-pointer"
                    style={{ borderBottom: '1px solid #e0e0e0' }}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004492" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium mb-0.5" style={{ color: '#1f1f1f' }}>
                        클라이언트 모드
                      </h3>
                      <p className="text-xs" style={{ color: '#5f6368' }}>
                        서버에 연결하여 사용하는 클라이언트로 설정합니다.
                      </p>
                    </div>
                  </button>

                  <div className="px-4 py-4">
                    <p className="text-sm" style={{ color: '#5f6368' }}>
                      서버 모드는 데이터베이스를 관리하며, 클라이언트 모드는 서버에 연결하여 사용합니다.
                    </p>
                  </div>
                </div>
              )}

              {/* SERVER - Step 2: Company Name */}
              {mode === 'server' && step === 2 && (
                <form onSubmit={handleServerStep2Submit} className="max-w-lg space-y-4">
                  <div>
                    <Label htmlFor="companyName" className="text-sm mb-1.5 block font-medium" style={{ color: '#1f1f1f' }}>사무소 이름</Label>
                    <Input
                      id="companyName" type="text" placeholder="예: 택시아 세무회계 사무소"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                </form>
              )}

              {/* SERVER - Step 3: Admin Account */}
              {mode === 'server' && step === 3 && (
                <form onSubmit={handleServerStep3Submit} className="max-w-lg space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm mb-1.5 block font-medium" style={{ color: '#1f1f1f' }}>이름</Label>
                    <Input
                      id="name" type="text" placeholder="이름을 입력하세요"
                      value={adminData.name}
                      onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm mb-1.5 block font-medium" style={{ color: '#1f1f1f' }}>이메일</Label>
                    <Input
                      id="email" type="email" placeholder="이메일을 입력하세요"
                      value={adminData.email}
                      onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-sm mb-1.5 block font-medium" style={{ color: '#1f1f1f' }}>비밀번호</Label>
                    <Input
                      id="password" type="password" placeholder="최소 8자, 대소문자, 숫자 포함"
                      value={adminData.password}
                      onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm mb-1.5 block font-medium" style={{ color: '#1f1f1f' }}>비밀번호 확인</Label>
                    <Input
                      id="confirmPassword" type="password" placeholder="비밀번호를 다시 입력하세요"
                      value={adminData.confirmPassword}
                      onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  {error && <div className="text-red-600 text-sm whitespace-pre-wrap">{error}</div>}
                </form>
              )}

              {/* SERVER - Step 4: Summary */}
              {mode === 'server' && step === 4 && (
                <div className="flex flex-col h-full">
                  <div className="pt-2 pl-2">
                    <h2 className="text-lg font-medium mb-1" style={{ color: '#1f1f1f' }}>설정 완료</h2>
                    <p className="text-sm" style={{ color: '#5f6368' }}>
                      택시아를 사용할 준비가 되었습니다.
                    </p>
                  </div>
                </div>
              )}

              {/* CLIENT - Step 2: Server URL */}
              {mode === 'client' && step === 2 && (
                <form onSubmit={handleClientSubmit} className="max-w-lg space-y-4">
                  <div>
                    <Label htmlFor="serverUrl" className="text-sm mb-1.5 block font-medium" style={{ color: '#1f1f1f' }}>서버 URL</Label>
                    <Input
                      id="serverUrl" type="text" placeholder="예: http://192.168.1.100:3000"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      required
                    />
                    <p className="text-xs mt-1.5" style={{ color: '#80868b' }}>
                      서버 PC의 IP 주소와 포트 번호를 입력하세요. (예: http://192.168.1.100:3000)
                    </p>
                  </div>
                  {error && <div className="text-red-600 text-sm">{error}</div>}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Outside white card */}
      <div className="flex-shrink-0 flex justify-end items-center gap-2" style={{ height: '40px', padding: '0 4px' }}>
        <button
            type="button"
            onClick={handleBack}
            disabled={isLoading || step === 0 || (mode === 'server' && step === 4)}
            className="px-4 rounded-md text-sm transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: 'white',
              height: '28px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            뒤로 가기
          </button>
          <button
            type="submit"
            onClick={(e) => {
              if (step === 0) handleContinue();
              else if (mode === 'server') {
                if (step === 2) handleServerStep2Submit(e as any);
                else if (step === 3) handleServerStep3Submit(e as any);
                else if (step === 4) handleServerSummaryComplete();
              } else if (mode === 'client' && step === 2) {
                handleClientSubmit(e as any);
              }
            }}
            disabled={isLoading || step === 1}
            className="px-4 rounded-md text-sm transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: 'white',
              height: '28px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            {isLoading ? '처리 중...' : (
              (mode === 'server' && step === 4) || (mode === 'client' && step === 2) ? '완료' : '계속'
            )}
          </button>
      </div>
      </div>
    </div>
  );
};

export default SetupWizard;
