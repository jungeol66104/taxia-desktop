import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface WebhookStatusData {
  status: 'registered' | 'failed';
  webhookUrl?: string;
  tunnelUrl?: string;
  error?: string;
  timestamp: string;
  maxRetriesReached?: boolean;
}

interface WebhookHealthData {
  status: 'healthy' | 'degraded' | 'critical';
  message?: string;
  error?: string;
  consecutiveFailures?: number;
  maxFailures?: number;
  timestamp: string;
}

export const WebhookStatusNotification: React.FC = () => {
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusData | null>(null);
  const [healthStatus, setHealthStatus] = useState<WebhookHealthData | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Listen for webhook status changes
    const handleWebhookStatusChange = (data: WebhookStatusData) => {
      console.log('📡 Webhook status changed:', data);
      setWebhookStatus(data);
      setShowNotification(true);

      // Auto-hide success notifications after 5 seconds
      if (data.status === 'registered') {
        setTimeout(() => setShowNotification(false), 5000);
      }
    };

    // Listen for webhook health changes
    const handleWebhookHealthChange = (data: WebhookHealthData) => {
      console.log('🔍 Webhook health changed:', data);
      setHealthStatus(data);

      // Only show UI notification for degraded/critical health
      if (data.status !== 'healthy') {
        setShowNotification(true);
      } else {
        // Auto-hide when health is restored
        setTimeout(() => setShowNotification(false), 3000);
      }
    };

    // Register IPC listeners
    window.electronAPI?.onWebhookStatusChanged?.(handleWebhookStatusChange);
    window.electronAPI?.onWebhookHealthChanged?.(handleWebhookHealthChange);

    return () => {
      // Cleanup listeners if available
      window.electronAPI?.removeAllListeners?.('webhook-status-changed');
      window.electronAPI?.removeAllListeners?.('webhook-health-changed');
    };
  }, []);

  if (!showNotification) {
    return null;
  }

  const getNotificationConfig = () => {
    // Prioritize health issues over webhook status
    if (healthStatus && healthStatus.status !== 'healthy') {
      switch (healthStatus.status) {
        case 'critical':
          return {
            icon: <XCircleIcon className="h-5 w-5" />,
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            iconColor: 'text-red-500',
            title: 'Webhook Service Critical',
            message: `Health check failed: ${healthStatus.error || 'Unknown error'}. Attempting recovery...`,
            textColor: 'text-red-800'
          };
        case 'degraded':
          return {
            icon: <ExclamationTriangleIcon className="h-5 w-5" />,
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            iconColor: 'text-yellow-500',
            title: 'Webhook Service Degraded',
            message: `Health check issues (${healthStatus.consecutiveFailures}/${healthStatus.maxFailures}): ${healthStatus.error}`,
            textColor: 'text-yellow-800'
          };
      }
    }

    // Webhook registration status
    if (webhookStatus) {
      switch (webhookStatus.status) {
        case 'registered':
          return {
            icon: <CheckCircleIcon className="h-5 w-5" />,
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            iconColor: 'text-green-500',
            title: 'Webhook Registered',
            message: `Successfully registered with new tunnel URL`,
            textColor: 'text-green-800'
          };
        case 'failed':
          return {
            icon: <XCircleIcon className="h-5 w-5" />,
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            iconColor: 'text-red-500',
            title: 'Webhook Registration Failed',
            message: `Failed to register webhook: ${webhookStatus.error}${webhookStatus.maxRetriesReached ? ' (max retries reached)' : ''}`,
            textColor: 'text-red-800'
          };
      }
    }

    return null;
  };

  const config = getNotificationConfig();
  if (!config) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 shadow-lg`}>
        <div className="flex items-start">
          <div className={`${config.iconColor} flex-shrink-0`}>
            {config.icon}
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${config.textColor}`}>
              {config.title}
            </h3>
            <p className={`mt-1 text-sm ${config.textColor} opacity-75`}>
              {config.message}
            </p>
            {webhookStatus?.tunnelUrl && (
              <p className={`mt-1 text-xs ${config.textColor} opacity-50 font-mono`}>
                {webhookStatus.tunnelUrl}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className={`${config.textColor} opacity-50 hover:opacity-75 ml-2`}
          >
            <span className="sr-only">Close</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};