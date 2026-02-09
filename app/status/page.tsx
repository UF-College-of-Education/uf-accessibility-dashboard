'use client';

import { useState, useEffect } from 'react';
import { Site, fetchSites } from '../components/DataService';
import StatusCheckPage from '../components/StatusCheckPage';

export default function StatusPage() {
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSites() {
      const sites = await fetchSites();
      setAllSites(sites);
      setLoading(false);
    }
    loadSites();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  return <StatusCheckPage sites={allSites} />;
}