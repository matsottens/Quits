'use client';

import React, { useState } from 'react';
import { apiService } from '../../services/api';
import { Button } from '../ui/button';

interface ApiTestResult {
  ok: boolean;
  status: string;
  statusText: string;
  data?: any;
  error?: string;
}

export const ApiDiagnosticTool: React.FC = () => {
  const [testResult, setTestResult] = useState<ApiTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testApiConnection = async () => {
    setIsLoading(true);
    try {
      const result = await apiService.getSubscriptions();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        ok: false,
        status: '500',
        statusText: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">API Connection Test</h2>
      <Button
        onClick={testApiConnection}
        disabled={isLoading}
        className="mb-4"
      >
        {isLoading ? 'Testing...' : 'Test API Connection'}
      </Button>

      {testResult && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Test Results:</h3>
          <div className="space-y-2">
            <p>Status: {testResult.status} ({testResult.statusText})</p>
            <p>Success: {testResult.ok ? 'Yes' : 'No'}</p>
            {testResult.error && (
              <p className="text-red-500">Error: {testResult.error}</p>
            )}
            {testResult.data && (
              <pre className="bg-gray-100 p-2 rounded mt-2 overflow-auto">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 