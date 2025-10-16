// Mock data for development and testing
import { Client, Call, Task } from './types';

export const MOCK_CLIENTS: Client[] = [
  {
    id: 1,
    companyName: 'Hyundai Steel Co., Ltd.',
    representative: 'Kim Chul-soo',
    businessRegistrationNumber: '123-45-67890',
    contactNumber: '02-1234-5678',
    email: 'contact@hyundaisteel.com',
    address: 'Seoul, Gangnam-gu',
    assignee: 'Park Manager',
    contractDate: '2024-01-15',
    status: 'active',
  },
  {
    id: 2,
    companyName: 'Aram Corporation',
    representative: 'Eom Hye-ji',
    businessRegistrationNumber: '123-45-67891',
    contactNumber: '02-1234-5679',
    email: 'contact@aram.com',
    address: 'Seoul, Jung-gu',
    assignee: 'Park Manager',
    contractDate: '2024-02-20',
    status: 'active',
  },
  {
    id: 3,
    companyName: 'Betweens Central Law Firm',
    representative: 'Jo Yoon-seok',
    businessRegistrationNumber: '123-45-67892',
    contactNumber: '02-1234-5680',
    email: 'contact@betweens.com',
    address: 'Seoul, Seocho-gu',
    assignee: 'Choi Manager',
    contractDate: '2024-03-10',
    status: 'active',
  }
];

export const MOCK_CALLS: Call[] = [
  {
    id: 1,
    date: '2024-09-20',
    callerName: 'Kim Chul-soo',
    clientName: 'Hyundai Steel Co., Ltd.',
    phoneNumber: '02-1234-5678',
    recordingFileName: 'call_20240920_001.wav',
    transcriptFileName: 'call_20240920_001.txt',
    callDuration: '5:30',
  },
  {
    id: 2,
    date: '2024-09-19',
    callerName: 'Eom Hye-ji',
    clientName: 'Aram Corporation',
    phoneNumber: '02-1234-5679',
    recordingFileName: 'call_20240919_001.wav',
    transcriptFileName: 'call_20240919_001.txt',
    callDuration: '8:15',
  }
];

export const MOCK_TASKS: Task[] = [
  {
    id: 1,
    title: 'Corporate tax report draft',
    description: 'Prepare corporate tax filing documents',
    clientName: 'Hyundai Steel Co., Ltd.',
    assignee: 'Park Manager',
    status: 'in_progress',
    priority: 'high',
    startDate: '2024-09-15',
    dueDate: '2024-09-25',
    createdAt: '2024-09-15T09:00:00Z',
    progress: 75,
    category: 'Tax Filing',
    tags: ['corporate', 'tax', 'urgent']
  },
  {
    id: 2,
    title: 'Schedule client meeting',
    description: 'Coordinate meeting with client for contract review',
    clientName: 'Aram Corporation',
    assignee: 'Choi Manager',
    status: 'completed',
    priority: 'normal',
    startDate: '2024-09-18',
    dueDate: '2024-09-20',
    createdAt: '2024-09-18T10:00:00Z',
    progress: 100,
    category: 'Meeting',
    tags: ['meeting', 'contract']
  }
];