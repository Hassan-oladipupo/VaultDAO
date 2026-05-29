import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Bell,
  X,
  Filter,
  CheckCheck,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import NotificationItem from './NotificationItem';
import type { Notification, NotificationCategory, NotificationPriority, NotificationStatus } from '../types/notification';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'all' | 'proposals' | 'payments' | 'system';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'payments', label: 'Payments' },
  { id: 'system', label: 'System' },
];

const CATEGORY_MAP: Record<TabId, NotificationCategory | null> = {
  all: null,
  proposals: 'proposals',
  payments: 'payments',
  system: 'system',
};

function requestBrowserPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/vite.svg' });
  }
}

function groupNotifications(items: Notification[]): Notification[] {
  const groups = new Map<string, Notification[]>();
  const ungrouped: Notification[] = [];

  for (const n of items) {
    if (n.groupKey) {
      const existing = groups.get(n.groupKey) || [];
      existing.push(n);
      groups.set(n.groupKey, existing);
    } else {
      ungrouped.push(n);
    }
  }

  const result: Notification[] = [...ungrouped];
  for (const [, group] of groups) {
    if (group.length > 1) {
      const sorted = group.sort((a, b) => b.timestamp - a.timestamp);
      result.push({ ...sorted[0], count: group.length });
    } else if (group.length === 1) {
      result.push(group[0]);
    }
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    unreadCount,
    filter,
    sort,
    page,
    pageSize,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    setFilter,
    setSort,
    setPage,
    clearAll,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<NotificationCategory[]>(
    filter.categories
  );
  const [selectedPriorities, setSelectedPriorities] = useState<NotificationPriority[]>(
    filter.priorities
  );
  const [selectedStatus, setSelectedStatus] = useState<NotificationStatus | 'all'>(
    filter.status || 'all'
  );
  const [grouped, setGrouped] = useState(true);

  const panelRef = useRef<HTMLDivElement>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    requestBrowserPermission();
  }, []);

  // Compute category unread counts
  const tabUnreadCounts = useMemo(() => {
    const counts: Record<TabId, number> = { all: unreadCount, proposals: 0, payments: 0, system: 0 };
    for (const n of notifications) {
      if (n.status === 'unread') {
        if (n.category === 'proposals') counts.proposals++;
        else if (n.category === 'payments') counts.payments++;
        else if (n.category === 'system') counts.system++;
        else counts.system++;
      }
    }
    return counts;
  }, [notifications, unreadCount]);

  // Filter notifications by active tab
  const tabFiltered = useMemo(() => {
    const activeCategory = CATEGORY_MAP[activeTab];
    if (!activeCategory) return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeTab]);

  // Filter and sort notifications
  const filteredNotifications = useMemo(() => {
    let filtered = tabFiltered.filter((n) => {
      const categoryMatch = filter.categories.includes(n.category);
      const priorityMatch = filter.priorities.includes(n.priority);
      const statusMatch = !filter.status || n.status === filter.status;
      return categoryMatch && priorityMatch && statusMatch;
    });

    filtered.sort((a, b) => {
      if (sort.by === 'timestamp') {
        return sort.order === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
      } else if (sort.by === 'priority') {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return sort.order === 'desc' ? -diff : diff;
      }
      return 0;
    });

    return grouped ? groupNotifications(filtered) : filtered;
  }, [tabFiltered, filter, sort, grouped]);

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / pageSize);
  const paginatedNotifications = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredNotifications.slice(start, end);
  }, [filteredNotifications, page, pageSize]);

  const applyFilters = useCallback(() => {
    setFilter({
      categories: selectedCategories,
      priorities: selectedPriorities,
      status: selectedStatus === 'all' ? undefined : selectedStatus,
    });
    setShowFilters(false);
  }, [selectedCategories, selectedPriorities, selectedStatus, setFilter]);

  const resetFilters = useCallback(() => {
    setSelectedCategories(['proposals', 'approvals', 'system', 'payments']);
    setSelectedPriorities(['critical', 'high', 'normal', 'low']);
    setSelectedStatus('all');
    setFilter({
      categories: ['proposals', 'approvals', 'system', 'payments'],
      priorities: ['critical', 'high', 'normal', 'low'],
      status: undefined,
    });
    setShowFilters(false);
  }, [setFilter]);

  const toggleCategory = (category: NotificationCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const togglePriority = (priority: NotificationPriority) => {
    setSelectedPriorities((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  };

  // Send browser notification for critical items
  useEffect(() => {
    const latestCritical = notifications
      .filter((n) => n.priority === 'critical' && n.status === 'unread')
      .slice(0, 3);
    for (const n of latestCritical) {
      sendBrowserNotification(n.title, n.message);
    }
  }, [notifications]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      return () => document.removeEventListener('keydown', handleTab);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Notification Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-gray-900 border-l border-gray-700 z-[101] shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-center-title"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gray-800/50 backdrop-blur-md border-b border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell size={24} className="text-purple-400" />
              <h2 id="notification-center-title" className="text-xl font-bold text-white">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close notification center"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Categorized Tabs */}
          <div className="flex gap-1 mb-3" role="tablist" aria-label="Notification categories">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = tabUnreadCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tab-panel-${tab.id}`}
                  onClick={() => { setActiveTab(tab.id); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-purple-500' : 'bg-gray-600'
                    }`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors"
              aria-expanded={showFilters}
              aria-controls="filter-panel"
            >
              <Filter size={14} />
              <span>Filter</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            <button
              onClick={() => setGrouped(!grouped)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                grouped
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
              aria-label="Toggle notification grouping"
              aria-pressed={grouped}
            >
              <Layers size={14} />
              <span>Group</span>
            </button>

            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Mark all as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>

            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
              aria-label="Clear all notifications"
            >
              <Trash2 size={14} />
              <span>Clear all</span>
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div
              id="filter-panel"
              className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700"
              role="region"
              aria-label="Notification filters"
            >
              {/* Categories */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['proposals', 'approvals', 'payments', 'system'] as NotificationCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedCategories.includes(cat)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      aria-pressed={selectedCategories.includes(cat)}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priorities */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Priorities
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['critical', 'high', 'normal', 'low'] as NotificationPriority[]).map((pri) => (
                    <button
                      key={pri}
                      onClick={() => togglePriority(pri)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedPriorities.includes(pri)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      aria-pressed={selectedPriorities.includes(pri)}
                    >
                      {pri.charAt(0).toUpperCase() + pri.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <div className="flex gap-2">
                  {(['all', 'unread', 'read'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedStatus === status
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      aria-pressed={selectedStatus === status}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort by</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSort({ by: 'timestamp' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      sort.by === 'timestamp'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Time
                  </button>
                  <button
                    onClick={() => setSort({ by: 'priority' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      sort.by === 'priority'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Priority
                  </button>
                  <button
                    onClick={() => setSort({ order: sort.order === 'asc' ? 'desc' : 'asc' })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    {sort.order === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </button>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex gap-2">
                <button
                  onClick={applyFilters}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-300 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notification List */}
        <div
          id="tab-panel-all"
          role="tabpanel"
          aria-label={`${activeTab} notifications`}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {paginatedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bell size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg font-medium mb-2">No notifications</p>
              <p className="text-gray-500 text-sm">
                {filteredNotifications.length === 0 && notifications.length > 0
                  ? 'Try adjusting your filters'
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            paginatedNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDismiss={dismissNotification}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 bg-gray-800/50 border-t border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationCenter;
