import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, FormLabel, FormInput } from '../ui/form';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionData } from '../../types/subscription';

interface PhoneNumberFormData {
  phoneNumber: string;
}

interface LocationState {
  subscriptions: SubscriptionData[];
}

export const PhoneNumberInput: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptions } = (location.state as LocationState) || { subscriptions: [] };
  
  const [formData, setFormData] = useState<PhoneNumberFormData>({
    phoneNumber: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if profile exists when component mounts
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;

      try {
        console.log('Checking profile for user:', user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking profile:', error);
          if (error.code === 'PGRST116') {
            // Profile doesn't exist, create it
            console.log('Profile not found, creating new profile');
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                created_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error('Error creating profile:', insertError);
            }
          }
        } else {
          console.log('Existing profile found:', data);
        }
      } catch (err) {
        console.error('Error in checkProfile:', err);
      }
    };

    checkProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('No user found. Please sign in again.');
      return;
    }

    try {
      setLoading(true);
      console.log('Attempting to save phone number for user:', user.id);

      // Update the user's phone number in Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          phone_number: formData.phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }

      console.log('Successfully saved phone number');
      // Navigate to email scan screen
      navigate('/auth/consent');
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to save phone number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFEDD6] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <div className="flex justify-center">
            <img
              src="/quits-logo.svg"
              alt="Quits"
              className="h-20 w-auto mb-6"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Add your phone number
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We'll use this to send you important notifications about your subscriptions
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <Form onSubmit={handleSubmit}>
          <div className="mb-4">
            <FormLabel htmlFor="phoneNumber">Phone Number</FormLabel>
            <FormInput
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+1 (555) 555-5555"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#26457A] hover:bg-[#26457A]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#26457A]"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}; 