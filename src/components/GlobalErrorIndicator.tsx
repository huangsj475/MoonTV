'use client';

import { useEffect, useState, useRef } from 'react';

interface ErrorInfo {
  id: string;
  message: string;
  timestamp: number;
  type?: 'error' | 'success' | 'info'; // 新增：扩展类型支持
}

export function GlobalErrorIndicator() {
  const [currentError, setCurrentError] = useState<ErrorInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  // 新增：定时器 ref
  const autoHideTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 监听自定义错误事件
    const handleError = (event: CustomEvent) => {
      const { message, type = 'error' } = event.detail;
      const newError: ErrorInfo = {
        id: Date.now().toString(),
        message,
        timestamp: Date.now(),
		type,
      };

      // 如果已有错误，开始替换动画
      if (currentError) {
        setCurrentError(newError);
        setIsReplacing(true);

        // 动画完成后恢复正常
        setTimeout(() => {
          setIsReplacing(false);
        }, 200);
      } else {
        // 第一次显示错误
        setCurrentError(newError);
      }

      setIsVisible(true);

      // 自动消失逻辑：每次新错误都清理旧定时器，再设新定时器----------
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
      autoHideTimer.current = setTimeout(() => {
        handleClose();
      }, 3000); // 3秒后自动关闭
    };

    // 监听错误事件
    window.addEventListener('globalError', handleError as EventListener);

    return () => {
      window.removeEventListener('globalError', handleError as EventListener);
    };
  }, [currentError]);

  const handleClose = () => {
    setIsVisible(false);
    setCurrentError(null);
    setIsReplacing(false);
  };

  if (!isVisible || !currentError) {
    return null;
  }
    // 新增：根据类型设置不同的背景色
  const getBackgroundColor = () => {
    switch (currentError.type) {
      case 'success':
        return 'bg-green-500';
      case 'info':
        return 'bg-blue-500';
      case 'error':
      default:
        return 'bg-red-500';
    }
  };

  return (
    <div className='fixed top-4 right-4 z-[2000]'>
      {/* 错误卡片 */}
      <div
        className={`${getBackgroundColor()} text-white px-4 py-2 rounded-lg shadow-lg flex items-center justify-between max-w-md transition-all duration-300 ${
          isReplacing ? 'scale-105 opacity-80' : 'scale-100'
        } animate-fade-in`}
      >
        <span className='text-sm font-medium flex-1 mr-3'>
          {currentError.message}
        </span>
        <button
          onClick={handleClose}
          className='text-white hover:text-red-100 transition-colors flex-shrink-0'
          aria-label='关闭错误提示'
        >
          <svg
            className='w-5 h-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// 全局错误触发函数
export function triggerGlobalError(message: string, type: 'error' | 'success' | 'info' = 'error') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('globalError', {
        detail: { message, type },
      })
    );
  }
}
