import React, { useState } from 'react';
import { Message, ConversationTask } from '../../../shared/types';

export interface MessageThreadProps {
  messages: Message[];
  onTaskToggle?: (taskId: string) => void;
  onTaskSubmit?: (selectedTasks: number[]) => void;
  onSendMessage?: (message: string) => void;
  selectedTasks?: number[];
  showInput?: boolean;
  inputPlaceholder?: string;
  submitButtonText?: string;
  emptyStateText?: string;
  profileImageSrc?: string;
  className?: string;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  onTaskToggle,
  onTaskSubmit,
  onSendMessage,
  selectedTasks = [],
  showInput = true,
  inputPlaceholder = "메시지를 입력하세요...",
  submitButtonText = "전송",
  emptyStateText = "메시지가 없습니다.",
  profileImageSrc = "/src/renderer/assets/images/taxia-profile.png",
  className = ""
}) => {
  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = () => {
    if (messageInput.trim() && onSendMessage) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTaskSubmit = () => {
    if (onTaskSubmit && selectedTasks.length > 0) {
      onTaskSubmit(selectedTasks);
    }
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id} className="flex gap-3 py-3 px-4 hover:bg-gray-50">
              <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0">
                <img
                  src={profileImageSrc}
                  alt={message.author}
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
                  {message.author.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{message.author}</span>
                  <span className="text-xs text-gray-500">{message.timestamp}</span>
                </div>
                <div className="text-sm text-gray-900">
                  {message.content}
                </div>

                {/* Task extraction section */}
                {message.tasks && message.tasks.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border">
                    <div className="space-y-2 mb-3">
                      {message.tasks.map((task) => (
                        <div key={task.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            id={`task-${message.id}-${task.id}`}
                            checked={selectedTasks.includes(task.id)}
                            onChange={() => onTaskToggle?.(task.id)}
                            className="mt-0.5 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label
                            htmlFor={`task-${message.id}-${task.id}`}
                            className="flex-1 text-sm cursor-pointer"
                          >
                            <div className="font-medium text-gray-900">{task.title}</div>
                            <div className="text-xs text-gray-500">마감: {task.deadline}</div>
                          </label>
                        </div>
                      ))}
                    </div>

                    {selectedTasks.length > 0 && onTaskSubmit && (
                      <button
                        onClick={handleTaskSubmit}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        선택된 {selectedTasks.length}개 업무를 업무 탭으로 변환
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            {emptyStateText}
          </div>
        )}
      </div>

      {/* Message input */}
      {showInput && (
        <div className="border-t border-gray-200 p-3 flex-shrink-0">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-3 py-2 bg-gray-50 border-0 rounded text-sm focus:outline-none"
              placeholder={inputPlaceholder}
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitButtonText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageThread;