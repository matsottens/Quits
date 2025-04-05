import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationCenter } from '../components/NotificationCenter';
import { NotificationSettings } from '../components/NotificationSettings';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import SubscriptionList from '../components/dashboard/SubscriptionList';

const Dashboard: React.FC = () => {
  const { user, subscriptionState } = useAuth();

  return (
    <div className="min-h-screen bg-[#FFEDD6] p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <SubscriptionList />
          </div>
          <div className="space-y-4">
            <NotificationCenter />
            <NotificationSettings />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 