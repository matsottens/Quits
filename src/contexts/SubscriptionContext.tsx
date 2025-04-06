import React, { createContext, useContext, ReactNode } from 'react';
import { useSubscriptions } from '../hooks/useSubscriptions';

interface SubscriptionContextType {
  subscriptions: any[];
  loading: boolean;
  error: string | null;
  addSubscription: (subscription: any) => Promise<any>;
  updateSubscription: (id: string, updates: any) => Promise<any>;
  deleteSubscription: (id: string) => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscriptionContext = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const subscriptionData = useSubscriptions();

  return (
    <SubscriptionContext.Provider value={subscriptionData}>
      {children}
    </SubscriptionContext.Provider>
  );
}; 