import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { LoadingSpinner } from './shared/LoadingSpinner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
}

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getNotifications();
      if (response.ok && response.data) {
        setNotifications(response.data);
      } else {
        setError(response.error || 'Failed to fetch notifications');
      }
    } catch (err) {
      setError('An error occurred while fetching notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await apiService.markNotificationAsRead(id);
      if (response.ok) {
        setNotifications(notifications.map(notification =>
          notification.id === id ? { ...notification, read: true } : notification
        ));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchNotifications} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-500">No notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <Card key={notification.id} className={`p-4 ${notification.read ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{notification.title}</h3>
              <p className="text-gray-600 mt-1">{notification.message}</p>
              <p className="text-sm text-gray-400 mt-2">
                {new Date(notification.createdAt).toLocaleDateString()}
              </p>
            </div>
            {!notification.read && (
              <Button
                onClick={() => markAsRead(notification.id)}
                variant="outline"
                size="sm"
              >
                Mark as read
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}; 