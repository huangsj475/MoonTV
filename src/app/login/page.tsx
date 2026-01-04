/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import CryptoJS from 'crypto-js';//密码加密用

import { checkForUpdates, CURRENT_VERSION, UpdateStatus } from '@/lib/version';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// 本地存储的 key
const REMEMBERED_USERNAME_KEY = 'moonTV_remembered_username';
const REMEMBERED_PASSWORD_KEY = 'moonTV_remembered_password';
const REMEMBER_ME_KEY = 'moonTV_remember_me';
const ENCRYPTION_KEY = 'moonTV_remember_encryption_key';

// 安全警告组件
function SecurityWarning({ show, onConfirm }: {
  show: boolean; 
  onConfirm: () => void;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">
          安全警告
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          您选择了"记住密码"功能。请注意：
        </p>
        <ul className="text-xs text-gray-600 dark:text-gray-400 mb-4 space-y-1">
          <li>• 密码会加密存储在本地浏览器中</li>
          <li>• 不要在公共或不信任的电脑上使用此功能</li>
          <li>• 定期清理浏览器数据以确保安全</li>
          <li>• 建议仅在个人设备上使用此功能</li>
        </ul>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSecurityWarning(false)}
            className="flex-1 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            我已知晓风险
          </button>
        </div>
      </div>
    </div>
  );
}

// 版本显示组件
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <button
      onClick={() =>
        window.open('https://github.com/senshinya/MoonTV', '_blank')
      }
      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'
    >
      <span className='font-mono'>v{CURRENT_VERSION}</span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${
            updateStatus === UpdateStatus.HAS_UPDATE
              ? 'text-yellow-600 dark:text-yellow-400'
              : updateStatus === UpdateStatus.NO_UPDATE
              ? 'text-green-600 dark:text-green-400'
              : ''
          }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

// 加密函数
function encryptData(data: string): string {
  try {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  } catch {
    return data; // 加密失败时返回原数据（不推荐）
  }
}

// 解密函数
function decryptData(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return encryptedData; // 解密失败时返回原数据
  }
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [enableRegister, setEnableRegister] = useState(false);
  const { siteName } = useSite();
  //新增：记住账号和安全警告
  const [rememberMe, setRememberMe] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  
  // 在客户端挂载后设置配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageType = (window as any).RUNTIME_CONFIG?.STORAGE_TYPE;
      setShouldAskUsername(storageType && storageType !== 'localstorage');
      setEnableRegister(
        Boolean((window as any).RUNTIME_CONFIG?.ENABLE_REGISTER)
      );
      
      // 读取记住的用户名和密码
      const remembered = localStorage.getItem(REMEMBER_ME_KEY);
      if (remembered === 'true') {
        const savedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY);
        const savedPassword = localStorage.getItem(REMEMBERED_PASSWORD_KEY);
        
        if (savedUsername) {
          setUsername(savedUsername);
          setRememberMe(true);
        }
        
        if (savedPassword) {
          try {
            // 尝试解密密码
            const decryptedPassword = decryptData(savedPassword);
            setPassword(decryptedPassword);
          } catch (error) {
            console.error('解密密码失败:', error);
            // 如果解密失败，清除保存的密码
            localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
          }
        }
      }
    }
  }, []);

    // 处理记住账号的切换
  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    
	  setRememberMe(isChecked);
	  // 取消勾选时立即清除
	  if (!isChecked) {
		clearRememberedData();
	  }
	  // 勾选时：如果有输入用户名密码但还没保存过，显示警告
	  else if (username && password) {
		const hasSavedPassword = localStorage.getItem(REMEMBERED_PASSWORD_KEY);
		if (!hasSavedPassword) {
		  setShowSecurityWarning(true);
		}
	  }
  };

    // 清除保存的数据
  const clearRememberedData = () => {
    localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
  };

    // 保存账号信息到 localStorage
  const saveCredentials = () => {
    if (rememberMe && username) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
      
      if (password) {
        // 加密密码后再存储
        const encryptedPassword = encryptData(password);
        localStorage.setItem(REMEMBERED_PASSWORD_KEY, encryptedPassword);
      }
    } else {
      clearRememberedData();
    }
  };

    // 安全警告确认
  const handleSecurityWarningConfirm = () => {
    setRememberMe(true);
    setShowSecurityWarning(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        // 登录成功后保存凭证
        saveCredentials();
        
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else if (res.status === 401) {
        setError('用户名或密码错误！');
        // 登录失败时清除保存的密码（如果有）
        if (localStorage.getItem(REMEMBERED_PASSWORD_KEY)) {
          localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
          setPassword('');
        }
      } else if (res.status === 403) {
        setError('用户被封禁！');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理注册逻辑
  const handleRegister = async () => {
    setError(null);
    if (!password || !username) return;

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        // 注册成功后保存凭证
        saveCredentials();
        
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-md rounded-3xl bg-gradient-to-b from-white/90 via-white/70 to-white/40 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-zinc-900/40 backdrop-blur-xl shadow-2xl p-10 dark:border dark:border-zinc-800'>
        <h1 className='text-green-600 tracking-tight text-center text-3xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
          {siteName}
        </h1>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {shouldAskUsername && (
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <input
                id='username'
                type='text'
                autoComplete='username'
                className='block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur'
                placeholder='输入用户名'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor='password' className='sr-only'>
              密码
            </label>
            <input
              id='password'
              type='password'
              autoComplete='current-password'
              className='block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur'
              placeholder='输入访问密码'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

            {/* 记住账号选项 - 只在需要用户名时显示 */}
            {shouldAskUsername && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id='remember-me'
                    type='checkbox'
                    checked={rememberMe}
                    onChange={handleRememberMeChange}
                    className='h-4 w-4 text-green-600 rounded border-blue-500 focus:ring-green-500 dark:focus:ring-green-400'
                  />
                  <label
                    htmlFor='remember-me'
                    className='ml-2 block text-sm text-gray-700 dark:text-gray-300'
                  >
                    记住账号
                  </label>
                </div>
                
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400">
              {rememberMe && (
                <p className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ 密码将加密存储在本地浏览器中
                </p>
              )}
            </div>

          {error && (
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
          )}

          {/* 登录 / 注册按钮 */}
          {shouldAskUsername && enableRegister ? (
            <div className='flex gap-4'>
              <button
                type='button'
                onClick={handleRegister}
                disabled={!password || !username || loading}
                className='flex-1 inline-flex justify-center rounded-lg bg-blue-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? '注册中...' : '注册'}
              </button>
              <button
                type='submit'
                disabled={
                  !password || loading || (shouldAskUsername && !username)
                }
                className='flex-1 inline-flex justify-center rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-green-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </div>
          ) : (
            <button
              type='submit'
              disabled={
                !password || loading || (shouldAskUsername && !username)
              }
              className='inline-flex w-full justify-center rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-green-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? '登录中...' : '登录'}
            </button>
          )}
        </form>
      </div>

      {/* 版本信息显示 */}
      <VersionDisplay />
    </div>
    
      {/* 安全警告弹窗 */}
      <SecurityWarning 
        show={showSecurityWarning}
        onConfirm={handleSecurityWarningConfirm}
      />
    </>
  
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
