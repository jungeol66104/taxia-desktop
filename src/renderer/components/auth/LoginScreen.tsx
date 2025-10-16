import React, { useState } from 'react';
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import taxiaProfileImg from '../../assets/images/taxia-profile.png';

interface LoginScreenProps {
  onLogin: (userData: any) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleGetStarted = () => {
    setShowForm(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log('Auth attempt:', { isLoginMode, email: formData.email });
      console.log('ElectronAPI available:', !!window.electronAPI);
      console.log('AuthLogin method available:', !!window.electronAPI?.authLogin);
      console.log('AuthSignup method available:', !!window.electronAPI?.authSignup);

      if (isLoginMode) {
        if (!window.electronAPI?.authLogin) {
          setError('Authentication system not available');
          return;
        }

        console.log('Attempting login...');
        const result = await window.electronAPI.authLogin({
          email: formData.email,
          password: formData.password
        });

        console.log('Login result:', result);

        if (result.success) {
          onLogin(result.user);
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        if (!window.electronAPI?.authSignup) {
          setError('Authentication system not available');
          return;
        }

        console.log('Attempting signup...');
        const result = await window.electronAPI.authSignup({
          name: formData.name,
          email: formData.email,
          password: formData.password
        });

        console.log('Signup result:', result);

        if (result.success) {
          onLogin(result.user);
        } else {
          setError(result.error || 'Signup failed');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!showForm) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{
          background: 'linear-gradient(136.53deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.2) 100%), linear-gradient(312.01deg, #004492 0%, rgba(0,68,146,0.75) 100%)',
          backgroundColor: '#004492'
        }}
      >
        {/* Logo */}
        <div className="mb-8">
          <div className="w-16 h-16 flex items-center justify-center">
            <img
              src={taxiaProfileImg}
              alt="Taxia"
              className="w-14 h-14 rounded-lg object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div
              className="w-14 h-14 rounded-lg bg-white bg-opacity-20 flex items-center justify-center text-xl font-bold text-white"
              style={{ display: 'none' }}
            >
              T
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-9">
          <h1 className="text-3xl font-light text-white mb-2">
            택시아
          </h1>
          <p className="text-sm text-white text-opacity-80">
            AI 기반 세무 업무 자동화 솔루션
          </p>
        </div>

        {/* Get Started Button */}
        <button
          onClick={handleGetStarted}
          className="px-12 bg-white text-blue-900 text-base font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
          style={{
            height: '40px',
            minWidth: '160px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          시작하기
        </button>

      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background: 'linear-gradient(136.53deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.2) 100%), linear-gradient(312.01deg, #004492 0%, rgba(0,68,146,0.75) 100%)',
        backgroundColor: '#004492'
      }}
    >
      <div className="w-full max-w-sm">
        {/* Auth Form */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-white mb-2">
            {isLoginMode ? '로그인' : '회원가입'}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            {!isLoginMode && (
              <div className="grid gap-3">
                <Label htmlFor="name" className="text-white">이름</Label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 bg-gray-50 border-0 rounded text-sm focus:outline-none h-9"
                  required
                />
              </div>
            )}

            <div className="grid gap-3">
              <Label htmlFor="email" className="text-white">이메일</Label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 bg-gray-50 border-0 rounded text-sm focus:outline-none h-9"
                required
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="password" className="text-white">비밀번호</Label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 bg-gray-50 border-0 rounded text-sm focus:outline-none h-9"
                required
              />
            </div>

            {error && (
              <div className="text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-12 bg-white text-blue-900 text-base font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                style={{
                  height: '40px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                {isLoading ? '처리중...' : (isLoginMode ? '로그인' : '회원가입')}
              </button>
            </div>
          </div>

          <div className="mt-4 text-center text-sm text-white">
            {isLoginMode ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
                setFormData({ name: '', email: '', password: '' });
              }}
              className="underline underline-offset-4 cursor-pointer"
            >
              {isLoginMode ? '회원가입' : '로그인'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};

export default LoginScreen;