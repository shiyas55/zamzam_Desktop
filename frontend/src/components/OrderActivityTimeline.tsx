import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { apiClient } from '../services/apiClient';

interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  user_name: string;
  user_role: string;
  source: string;
  details: any;
}

export const OrderActivityTimeline: React.FC<{ orderId: string }> = ({ orderId }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<ActivityLog[]>(`/orders/orders/${orderId}/activity/`);
        setLogs(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (orderId) fetchLogs();
  }, [orderId]);

  if (loading) return <div style={{ padding: '1rem', textAlign: 'center' }}>Loading activity timeline...</div>;
  if (error) return <div style={{ color: 'red', padding: '1rem' }}>{error}</div>;
  if (logs.length === 0) return <div style={{ padding: '1rem', color: '#666' }}>No activity logs found.</div>;

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1f2937' }}>Activity Timeline</h4>
      <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
        {logs.map((log, index) => (
          <div key={log.id} style={{ position: 'relative', paddingBottom: index === logs.length - 1 ? '0' : '1.5rem' }}>
            {/* Line connecting dots */}
            {index !== logs.length - 1 && (
              <div style={{ position: 'absolute', left: '-19px', top: '24px', bottom: '0', width: '2px', background: '#e5e7eb' }}></div>
            )}
            
            {/* Dot */}
            <div style={{ position: 'absolute', left: '-23px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', border: '2px solid #fee2e2' }}></div>
            
            <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>{log.action}</span>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <div style={{ color: '#4b5563', fontSize: '0.8rem', display: 'flex', gap: '1rem' }}>
                <span>User: <strong>{log.user_name || 'System'}</strong> ({log.user_role})</span>
                <span>Source: <strong>{log.source}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
