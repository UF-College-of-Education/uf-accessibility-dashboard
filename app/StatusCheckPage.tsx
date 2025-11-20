// app/components/StatusCheckPage.tsx

'use client';

import { useState, useEffect } from 'react';
import { statusManager, SiteStatus, PageStatus } from './StatusService';
import { Site } from './DataService';
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  sites: Site[];
}

export default function StatusCheckPage({ sites }: Props) {
  const [siteStatuses, setSiteStatuses] = useState<SiteStatus[]>([]);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<string[]>(['Noah', 'Abhi']);
  const [newPerson, setNewPerson] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [changes, setChanges] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    // Initialize status data
    statusManager.initializeSiteStatuses(sites);
    
    const data = statusManager.getStatusData();
    if (data) {
      setSiteStatuses(data.siteStatuses);
      setPeople(data.people);
    }
  }, [sites]);

  function toggleSiteExpand(siteId: string) {
    const newExpanded = new Set(expandedSites);
    if (newExpanded.has(siteId)) {
      newExpanded.delete(siteId);
    } else {
      newExpanded.add(siteId);
    }
    setExpandedSites(newExpanded);
  }

  function handlePageStatusChange(
    siteId: string,
    pageUrl: string,
    newStatus: 'pending' | 'working' | 'completed',
    person: string | null
  ) {
    statusManager.updatePageStatus(siteId, pageUrl, newStatus, person);
    setChanges(true);

    const data = statusManager.getStatusData();
    if (data) {
      setSiteStatuses([...data.siteStatuses]);
    }
  }

  function handleAddPerson() {
    if (newPerson.trim() && !people.includes(newPerson)) {
      statusManager.addPerson(newPerson);
      setPeople([...people, newPerson]);
      setNewPerson('');
      setShowAddPerson(false);
      setChanges(true);
    }
  }

  function handleSubmit() {
    setSavedMessage('✅ All changes saved successfully!');
    setChanges(false);
    setTimeout(() => setSavedMessage(''), 3000);
  }

  const stats = statusManager.getCompletionStats();
  const completionPercentage = stats.totalPages > 0 ? Math.round((stats.completedPages / stats.totalPages) * 100) : 0;
  const siteCompletionPercentage = stats.totalSites > 0 ? Math.round((stats.completedSites / stats.totalSites) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📊 Status Check</h1>
          <p className="text-gray-600">Track completion status for all sites and pages</p>
        </div>

        {/* Saved Message */}
        {savedMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 font-semibold">
            {savedMessage}
          </div>
        )}

        {/* Completion Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Sites Completion */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900">Sites Completed</h3>
              <span className="text-2xl font-bold text-blue-600">{stats.completedSites}/{stats.totalSites}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${siteCompletionPercentage}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">{siteCompletionPercentage}% Complete</p>
          </div>

          {/* Pages Completion */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-green-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900">Pages Completed</h3>
              <span className="text-2xl font-bold text-green-600">{stats.completedPages}/{stats.totalPages}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-green-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">{completionPercentage}% Complete</p>
          </div>
        </div>

        {/* Add Person Section */}
        <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900">Team Members</h3>
            <button
              onClick={() => setShowAddPerson(!showAddPerson)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {showAddPerson ? 'Cancel' : '+ Add Person'}
            </button>
          </div>

          {showAddPerson && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter name..."
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={handleAddPerson}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Add
              </button>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {people.map(person => (
              <span key={person} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                {person}
              </span>
            ))}
          </div>
        </div>

        {/* Sites List */}
        <div className="space-y-4">
          {siteStatuses.map(site => {
            const completedPages = site.pages.filter(p => p.isCompleted).length;
            const isExpanded = expandedSites.has(site.id);

            return (
              <div key={site.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                {/* Site Header */}
                <div
                  className="p-4 hover:bg-gray-50 cursor-pointer transition flex items-center justify-between"
                  onClick={() => toggleSiteExpand(site.id)}
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{site.title}</h3>
                    <p className="text-sm text-gray-600">{site.baseUrl}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-700">
                        {completedPages}/{site.pages.length} Pages Completed
                      </div>
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(completedPages / site.pages.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={24} className="text-gray-600" />
                  ) : (
                    <ChevronDown size={24} className="text-gray-600" />
                  )}
                </div>

                {/* Pages List */}
                {isExpanded && (
                  <div className="border-t p-4 space-y-3 bg-gray-50">
                    {site.pages.map(page => (
                      <PageStatusRow
                        key={page.url}
                        page={page}
                        people={people}
                        siteId={site.id}
                        onStatusChange={handlePageStatusChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!changes}
            className={`px-8 py-3 rounded-lg font-bold text-white text-lg transition ${
              changes
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            💾 SUBMIT
          </button>
        </div>
      </div>
    </div>
  );
}

interface PageStatusRowProps {
  page: PageStatus;
  people: string[];
  siteId: string;
  onStatusChange: (siteId: string, pageUrl: string, status: 'pending' | 'working' | 'completed', person: string | null) => void;
}

function PageStatusRow({ page, people, siteId, onStatusChange }: PageStatusRowProps) {
  const [selectedPerson, setSelectedPerson] = useState<string>(page.completedBy || '');
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'working' | 'completed'>(page.status);

  function handlePersonChange(person: string) {
    setSelectedPerson(person);
    onStatusChange(siteId, page.url, selectedStatus, person || null);
  }

  function handleStatusChange(status: 'pending' | 'working' | 'completed') {
    setSelectedStatus(status);
    onStatusChange(siteId, page.url, status, selectedPerson || null);
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h4 className="font-semibold text-gray-900">{page.title}</h4>
          <p className="text-xs text-gray-600 truncate">{page.url}</p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-3">
          {selectedStatus === 'completed' ? (
            <CheckCircle className="text-green-600" size={20} />
          ) : selectedStatus === 'working' ? (
            <AlertCircle className="text-yellow-600" size={20} />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
          )}
        </div>

        {/* Person Dropdown */}
        <select
          value={selectedPerson}
          onChange={(e) => handlePersonChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">Select Person</option>
          {people.map(person => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => handleStatusChange(e.target.value as 'pending' | 'working' | 'completed')}
          className={`px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm ${
            selectedStatus === 'completed'
              ? 'border-green-300 bg-green-50'
              : selectedStatus === 'working'
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-gray-300'
          }`}
        >
          <option value="pending">Pending</option>
          <option value="working">Working on it</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>
  );
}