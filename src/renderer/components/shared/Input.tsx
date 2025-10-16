import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'form' | 'message';
  label?: string;
  className?: string;
}

const Input: React.FC<InputProps> = ({
  variant = 'form',
  label,
  className = '',
  ...props
}) => {
  const baseClasses = 'px-3 bg-gray-50 border-0 rounded text-sm focus:outline-none';

  const variantClasses = {
    form: 'w-full py-1.5',
    message: 'flex-1 py-2'
  };

  const inputClasses = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  if (label) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input className={inputClasses} {...props} />
      </div>
    );
  }

  return <input className={inputClasses} {...props} />;
};

export default Input;