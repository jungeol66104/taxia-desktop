import React from 'react';

export interface FormField {
  label: string;
  value: string | number | null;
  type?: 'text' | 'select' | 'textarea' | 'date' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
}

export interface FormSectionProps {
  title?: string;
  fields: FormField[];
  onChange?: (fieldIndex: number, value: string) => void;
  onSubmit?: () => void;
  submitText?: string;
  className?: string;
  fieldClassName?: string;
  spacing?: 'tight' | 'normal' | 'loose';
}

const FormSection: React.FC<FormSectionProps> = ({
  title,
  fields,
  onChange,
  onSubmit,
  submitText = "저장",
  className = "",
  fieldClassName = "",
  spacing = 'normal'
}) => {
  const getSpacingClass = () => {
    switch (spacing) {
      case 'tight': return 'space-y-2';
      case 'loose': return 'space-y-4';
      default: return 'space-y-3';
    }
  };

  const renderField = (field: FormField, index: number) => {
    const baseInputClass = `w-full px-3 py-1.5 border-0 rounded text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
      field.readOnly ? 'bg-gray-100' : 'bg-white border border-gray-300'
    } ${field.className || ''}`;

    const fieldContent = () => {
      switch (field.type) {
        case 'select':
          return (
            <select
              value={field.value || ''}
              onChange={(e) => onChange?.(index, e.target.value)}
              disabled={field.readOnly}
              className={baseInputClass}
            >
              <option value="">{field.placeholder || '선택하세요'}</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );

        case 'textarea':
          return (
            <textarea
              value={field.value || ''}
              onChange={(e) => onChange?.(index, e.target.value)}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              rows={3}
              className={`${baseInputClass} resize-none`}
            />
          );

        case 'date':
          return (
            <input
              type="date"
              value={field.value || ''}
              onChange={(e) => onChange?.(index, e.target.value)}
              readOnly={field.readOnly}
              className={baseInputClass}
            />
          );

        case 'number':
          return (
            <input
              type="number"
              value={field.value || ''}
              onChange={(e) => onChange?.(index, e.target.value)}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              className={baseInputClass}
            />
          );

        default:
          return (
            <input
              type="text"
              value={field.value || ''}
              onChange={(e) => onChange?.(index, e.target.value)}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              className={baseInputClass}
            />
          );
      }
    };

    return (
      <div key={index} className={fieldClassName}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {fieldContent()}
      </div>
    );
  };

  return (
    <div className={`p-4 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      )}

      <div className={getSpacingClass()}>
        {fields.map((field, index) => renderField(field, index))}
      </div>

      {onSubmit && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onSubmit}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {submitText}
          </button>
        </div>
      )}
    </div>
  );
};

export default FormSection;