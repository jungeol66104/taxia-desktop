import React, { useState, useRef, useEffect } from 'react';
import { CornerDownLeft } from 'lucide-react';

export interface MessageInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  placeholder = "메시지를 입력하세요...",
  disabled = false,
  className = ""
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  return (
    <div className={`p-4 flex-shrink-0 ${className}`}>
      <div className="border border-gray-300 rounded-lg p-3 flex flex-col gap-3 bg-white">
        <textarea
          ref={textareaRef}
          className="w-full border-0 focus:ring-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none shadow-none px-0 py-0 resize-none min-h-0 bg-white text-sm"
          placeholder={placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          rows={1}
          style={{ maxHeight: '200px', overflowY: 'auto' }}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white w-8 h-8 p-0 rounded flex items-center justify-center transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none"
          >
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;