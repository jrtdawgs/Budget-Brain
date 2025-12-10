import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  { id: 'food', name: 'Food & Dining', emoji: '🍔', color: '#FF6B6B', gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)' },
  { id: 'transport', name: 'Transport', emoji: '🚗', color: '#4ECDC4', gradient: 'linear-gradient(135deg, #4ECDC4, #7EDDD6)' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#A78BFA', gradient: 'linear-gradient(135deg, #A78BFA, #C4B5FD)' },
  { id: 'bills', name: 'Bills & Utilities', emoji: '⚡', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #F472B6)' },
  { id: 'health', name: 'Health', emoji: '💊', color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #34D399)' },
  { id: 'groceries', name: 'Groceries', emoji: '🥑', color: '#84CC16', gradient: 'linear-gradient(135deg, #84CC16, #A3E635)' },
  { id: 'subscriptions', name: 'Subscriptions', emoji: '📺', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)' },
  { id: 'other', name: 'Other', emoji: '📦', color: '#6B7280', gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)' },
];

export default function BudgetBrain() {
  const [view, setView] = useState('upload');
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const txData = localStorage.getItem('budget-transactions-v3');
      const budgetData = localStorage.getItem('budget-limits-v3');
      if (txData) setTransactions(JSON.parse(txData));
      if (budgetData) setBudgets(JSON.parse(budgetData));
      if (txData && JSON.parse(txData).length > 0) setView('dashboard');
    } catch (e) {}
    setDataLoaded(true);
  };

  const saveData = (newTx, newBudgets) => {
    try {
      localStorage.setItem('budget-transactions-v3', JSON.stringify(newTx));
      localStorage.setItem('budget-limits-v3', JSON.stringify(newBudgets));
    } catch (e) {}
  };

  const processImageWithAI = async (base64Data, mimeType) => {
    setIsLoading(true);
    setLoadingMessage('Reading your transactions...');
    
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } },
              { type: "text", text: `Extract all transactions from this bank statement/screenshot. For each, get description, amount (positive number), and date.

Categorize each into: food, transport, shopping, bills, entertainment, health, groceries, subscriptions, other

Respond with ONLY a JSON array:
[{"description": "UBER EATS", "amount": 24.50, "date": "12/01", "category": "food"}]

If unreadable, respond: []` }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '[]';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      
      if (parsed.length === 0) {
        alert("Couldn't read transactions. Try a clearer image.");
        setIsLoading(false);
        return;
      }
      
      const formatted = parsed.map((t, idx) => ({
        id: Date.now() + idx,
        description: t.description || 'Unknown',
        amount: parseFloat(t.amount) || 0,
        date: t.date || 'N/A',
        category: t.category || 'other'
      })).filter(t => t.amount > 0);
      
      const merged = [...transactions, ...formatted];
      setTransactions(merged);
      await saveData(merged, budgets);
      
      setLoadingMessage(`Found ${formatted.length} transactions!`);
      setTimeout(() => {
        setView(Object.keys(budgets).length > 0 ? 'dashboard' : 'budgets');
        setIsLoading(false);
        setPreviewImage(null);
      }, 1200);
    } catch (e) {
      alert('Failed to process. Please try again.');
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Full = event.target.result;
      setPreviewImage(base64Full);
      processImageWithAI(base64Full.split(',')[1], file.type || 'image/png');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Full = event.target.result;
        setPreviewImage(base64Full);
        processImageWithAI(base64Full.split(',')[1], file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateBudget = (id, value) => {
    const newBudgets = { ...budgets, [id]: parseFloat(value) || 0 };
    setBudgets(newBudgets);
    saveData(transactions, newBudgets);
  };

  const getSpending = () => {
    const s = {};
    CATEGORIES.forEach(c => s[c.id] = 0);
    transactions.forEach(t => { if (t.category) s[t.category] += t.amount; });
    return s;
  };

  const getTotalSpent = () => transactions.reduce((s, t) => s + t.amount, 0);
  const getTotalBudget = () => Object.values(budgets).reduce((s, b) => s + b, 0);

  const resetAll = () => {
    setTransactions([]);
    setBudgets({});
    setShowResetConfirm(false);
    try {
      localStorage.removeItem('budget-transactions-v3');
      localStorage.removeItem('budget-limits-v3');
    } catch (e) {
      console.log('Storage delete error:', e);
    }
    setView('upload');
  };

  const spending = getSpending();
  const totalSpent = getTotalSpent();
  const totalBudget = getTotalBudget();
  const remaining = totalBudget - totalSpent;
  const spentPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  if (!dataLoaded) return <div style={styles.loadingScreen}><div style={styles.loadingLogo}>💰</div></div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoSection}>
          <span style={styles.logoIcon}>💰</span>
          <span style={styles.logoText}>BudgetBrain</span>
        </div>
        {view !== 'upload' && (
          <nav style={styles.nav}>
            <button onClick={() => setView('dashboard')} style={{...styles.navBtn, ...(view === 'dashboard' ? styles.navBtnActive : {})}}>Dashboard</button>
            <button onClick={() => setView('budgets')} style={{...styles.navBtn, ...(view === 'budgets' ? styles.navBtnActive : {})}}>Budgets</button>
          </nav>
        )}
      </header>

      {/* Upload View */}
      {view === 'upload' && (
        <div style={styles.uploadView}>
          <div style={styles.heroSection}>
            <h1 style={styles.heroTitle}>Track spending with<br/><span style={styles.heroHighlight}>just a screenshot</span></h1>
            <p style={styles.heroSubtitle}>No bank connections. No spreadsheets. Just snap a photo of your transactions.</p>
          </div>

          <div 
            style={{...styles.dropZone, ...(isDragging ? styles.dropZoneActive : {})}}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <div style={styles.dropZoneInner}>
              <div style={styles.uploadIconWrapper}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color: '#A78BFA'}}>
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9m0 0l-3-3m3 3l3-3"/>
                </svg>
              </div>
              <p style={styles.dropText}>Drop your screenshot here</p>
              <p style={styles.dropSubtext}>or</p>
              <label style={styles.uploadBtn}>
                <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{display:'none'}}/>
                Choose Image
              </label>
            </div>
          </div>

          <div style={styles.features}>
            <div style={styles.featureCard}>
              <span style={styles.featureIcon}>📸</span>
              <h3 style={styles.featureTitle}>Screenshot & Go</h3>
              <p style={styles.featureDesc}>Works with any banking app screenshot</p>
            </div>
            <div style={styles.featureCard}>
              <span style={styles.featureIcon}>🤖</span>
              <h3 style={styles.featureTitle}>AI Powered</h3>
              <p style={styles.featureDesc}>Automatically reads and categorizes</p>
            </div>
            <div style={styles.featureCard}>
              <span style={styles.featureIcon}>🔒</span>
              <h3 style={styles.featureTitle}>Private</h3>
              <p style={styles.featureDesc}>No bank login required</p>
            </div>
          </div>

          {transactions.length > 0 && (
            <button onClick={() => setView('dashboard')} style={styles.continueDashboard}>
              Continue to Dashboard →
            </button>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingModal}>
            {previewImage && <img src={previewImage} alt="" style={styles.loadingPreview}/>}
            <div style={styles.loadingSpinner}>
              <div style={styles.spinnerRing}></div>
            </div>
            <p style={styles.loadingText}>{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* Dashboard View */}
      {view === 'dashboard' && (
        <div style={styles.dashboardView}>
          {/* Overview Card */}
          <div style={styles.overviewCard}>
            <div style={styles.overviewHeader}>
              <div>
                <p style={styles.overviewLabel}>Total Spent</p>
                <h2 style={styles.overviewAmount}>${totalSpent.toFixed(2)}</h2>
              </div>
              <div style={styles.overviewBudget}>
                <span style={{...styles.remainingBadge, background: remaining >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: remaining >= 0 ? '#10B981' : '#EF4444'}}>
                  {remaining >= 0 ? '+' : ''}{remaining.toFixed(2)} left
                </span>
              </div>
            </div>
            {totalBudget > 0 && (
              <div style={styles.overviewProgress}>
                <div style={styles.progressTrack}>
                  <div style={{...styles.progressFill, width: `${spentPercent}%`, background: spentPercent > 90 ? '#EF4444' : 'linear-gradient(90deg, #A78BFA, #EC4899)'}}></div>
                </div>
                <div style={styles.progressLabels}>
                  <span>${totalSpent.toFixed(0)} spent</span>
                  <span>${totalBudget.toFixed(0)} budget</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Add */}
          <label style={styles.quickAddBtn}>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{display:'none'}}/>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
            Add Transactions
          </label>

          {/* Categories */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Spending by Category</h3>
            <div style={styles.categoryGrid}>
              {CATEGORIES.filter(c => spending[c.id] > 0 || budgets[c.id] > 0).map(cat => {
                const spent = spending[cat.id];
                const budget = budgets[cat.id] || 0;
                const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                const over = budget > 0 && spent > budget;
                
                return (
                  <div key={cat.id} style={styles.categoryCard}>
                    <div style={styles.categoryHeader}>
                      <div style={{...styles.categoryIcon, background: cat.gradient}}>{cat.emoji}</div>
                      <div style={styles.categoryInfo}>
                        <span style={styles.categoryName}>{cat.name}</span>
                        <span style={{...styles.categorySpent, color: over ? '#EF4444' : '#1F2937'}}>
                          ${spent.toFixed(2)}{budget > 0 && <span style={styles.categoryBudget}> / ${budget}</span>}
                        </span>
                      </div>
                    </div>
                    {budget > 0 && (
                      <div style={styles.categoryProgress}>
                        <div style={{...styles.categoryProgressFill, width: `${pct}%`, background: over ? '#EF4444' : cat.color}}></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transactions */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Recent Transactions</h3>
              <span style={styles.txCount}>{transactions.length} total</span>
            </div>
            <div style={styles.txList}>
              {transactions.slice(0, 15).map(t => {
                const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[8];
                return (
                  <div key={t.id} style={styles.txRow}>
                    <div style={{...styles.txIcon, background: cat.gradient}}>{cat.emoji}</div>
                    <div style={styles.txDetails}>
                      <span style={styles.txName}>{t.description}</span>
                      <span style={styles.txMeta}>{cat.name} · {t.date}</span>
                    </div>
                    <span style={styles.txAmount}>-${t.amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={() => setShowResetConfirm(true)} style={styles.resetBtn}>Reset All Data</button>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.confirmModal}>
            <div style={styles.confirmIcon}>⚠️</div>
            <h3 style={styles.confirmTitle}>Reset All Data?</h3>
            <p style={styles.confirmText}>This will delete all your transactions and budgets. This cannot be undone.</p>
            <div style={styles.confirmButtons}>
              <button onClick={() => setShowResetConfirm(false)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={resetAll} style={styles.confirmDeleteBtn}>Yes, Delete Everything</button>
            </div>
          </div>
        </div>
      )}

      {/* Budgets View */}
      {view === 'budgets' && (
        <div style={styles.budgetsView}>
          <div style={styles.budgetsHeader}>
            <h2 style={styles.budgetsTitle}>Set Your Budgets</h2>
            <p style={styles.budgetsSubtitle}>Monthly spending limits for each category</p>
          </div>

          <div style={styles.budgetsList}>
            {CATEGORIES.map(cat => (
              <div key={cat.id} style={styles.budgetRow}>
                <div style={styles.budgetInfo}>
                  <div style={{...styles.budgetIcon, background: cat.gradient}}>{cat.emoji}</div>
                  <div>
                    <span style={styles.budgetName}>{cat.name}</span>
                    <span style={styles.budgetSpent}>Spent: ${spending[cat.id].toFixed(2)}</span>
                  </div>
                </div>
                <div style={styles.budgetInputGroup}>
                  <span style={styles.budgetDollar}>$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={budgets[cat.id] || ''}
                    onChange={(e) => updateBudget(cat.id, e.target.value)}
                    style={styles.budgetInput}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={styles.budgetSummary}>
            <div style={styles.summaryRow}>
              <span>Total Monthly Budget</span>
              <span style={styles.summaryValue}>${totalBudget.toFixed(2)}</span>
            </div>
          </div>

          <button onClick={() => setView('dashboard')} style={styles.saveBudgetsBtn}>
            Save & View Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    background: '#F8FAFC',
    minHeight: '100vh',
    color: '#1F2937',
  },
  loadingScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#F8FAFC',
  },
  loadingLogo: {
    fontSize: '3rem',
    animation: 'pulse 1.5s ease infinite',
  },
  
  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    background: '#fff',
    borderBottom: '1px solid #E5E7EB',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    fontSize: '1.5rem',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #A78BFA, #EC4899)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navBtn: {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    color: '#6B7280',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  navBtnActive: {
    background: '#F3E8FF',
    color: '#7C3AED',
  },

  // Upload View
  uploadView: {
    padding: '40px 24px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  heroSection: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  heroTitle: {
    fontSize: '2.25rem',
    fontWeight: '800',
    lineHeight: '1.2',
    color: '#111827',
    margin: '0 0 16px 0',
  },
  heroHighlight: {
    background: 'linear-gradient(135deg, #A78BFA, #EC4899)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.1rem',
    color: '#6B7280',
    margin: 0,
    lineHeight: '1.6',
  },
  dropZone: {
    background: '#fff',
    borderRadius: '20px',
    border: '2px dashed #D1D5DB',
    padding: '8px',
    marginBottom: '32px',
    transition: 'all 0.3s',
  },
  dropZoneActive: {
    borderColor: '#A78BFA',
    background: '#FAF5FF',
  },
  dropZoneInner: {
    background: '#FAFAFA',
    borderRadius: '14px',
    padding: '48px 24px',
    textAlign: 'center',
  },
  uploadIconWrapper: {
    marginBottom: '16px',
  },
  dropText: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 4px 0',
  },
  dropSubtext: {
    color: '#9CA3AF',
    margin: '8px 0 16px 0',
    fontSize: '0.9rem',
  },
  uploadBtn: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #A78BFA, #EC4899)',
    color: '#fff',
    fontWeight: '600',
    padding: '14px 32px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '1rem',
    boxShadow: '0 4px 14px rgba(167, 139, 250, 0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '32px',
  },
  featureCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px 16px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  featureIcon: {
    fontSize: '2rem',
    marginBottom: '12px',
    display: 'block',
  },
  featureTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    margin: '0 0 6px 0',
    color: '#111827',
  },
  featureDesc: {
    fontSize: '0.8rem',
    color: '#6B7280',
    margin: 0,
    lineHeight: '1.4',
  },
  continueDashboard: {
    width: '100%',
    background: '#111827',
    color: '#fff',
    border: 'none',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // Loading
  loadingOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingModal: {
    background: '#fff',
    borderRadius: '24px',
    padding: '32px',
    textAlign: 'center',
    maxWidth: '320px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  loadingPreview: {
    width: '100%',
    maxHeight: '180px',
    objectFit: 'contain',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  loadingSpinner: {
    width: '56px',
    height: '56px',
    margin: '0 auto 20px',
    position: 'relative',
  },
  spinnerRing: {
    width: '100%',
    height: '100%',
    border: '4px solid #E5E7EB',
    borderTopColor: '#A78BFA',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#374151',
    margin: 0,
  },

  // Dashboard
  dashboardView: {
    padding: '24px',
    maxWidth: '700px',
    margin: '0 auto',
  },
  overviewCard: {
    background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
    borderRadius: '24px',
    padding: '28px',
    color: '#fff',
    marginBottom: '20px',
    boxShadow: '0 10px 40px rgba(31, 41, 55, 0.3)',
  },
  overviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  overviewLabel: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.7)',
    margin: '0 0 4px 0',
  },
  overviewAmount: {
    fontSize: '2.5rem',
    fontWeight: '700',
    margin: 0,
  },
  remainingBadge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  overviewProgress: {
    marginTop: '8px',
  },
  progressTrack: {
    height: '8px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.6)',
  },

  quickAddBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    background: '#fff',
    border: '2px dashed #D1D5DB',
    padding: '16px',
    borderRadius: '14px',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#6B7280',
    cursor: 'pointer',
    marginBottom: '28px',
    transition: 'all 0.2s',
  },

  section: {
    marginBottom: '28px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    margin: 0,
    color: '#111827',
  },
  txCount: {
    fontSize: '0.85rem',
    color: '#9CA3AF',
  },

  categoryGrid: {
    display: 'grid',
    gap: '12px',
  },
  categoryCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  categoryIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.3rem',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    display: 'block',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#374151',
  },
  categorySpent: {
    display: 'block',
    fontSize: '1.1rem',
    fontWeight: '700',
    marginTop: '2px',
  },
  categoryBudget: {
    fontWeight: '400',
    color: '#9CA3AF',
    fontSize: '0.9rem',
  },
  categoryProgress: {
    height: '4px',
    background: '#E5E7EB',
    borderRadius: '2px',
    marginTop: '12px',
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },

  txList: {
    background: '#fff',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  txRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 20px',
    borderBottom: '1px solid #F3F4F6',
  },
  txIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
  },
  txDetails: {
    flex: 1,
    minWidth: 0,
  },
  txName: {
    display: 'block',
    fontSize: '0.95rem',
    fontWeight: '500',
    color: '#1F2937',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  txMeta: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#9CA3AF',
    marginTop: '2px',
  },
  txAmount: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#EF4444',
  },

  resetBtn: {
    width: '100%',
    background: 'none',
    border: '1px solid #E5E7EB',
    padding: '14px',
    borderRadius: '12px',
    color: '#9CA3AF',
    fontSize: '0.9rem',
    cursor: 'pointer',
    marginTop: '12px',
  },

  // Confirmation Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  confirmModal: {
    background: '#fff',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '360px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  confirmIcon: {
    fontSize: '3rem',
    marginBottom: '16px',
  },
  confirmTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#111827',
  },
  confirmText: {
    fontSize: '0.95rem',
    color: '#6B7280',
    margin: '0 0 24px 0',
    lineHeight: '1.5',
  },
  confirmButtons: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    background: '#F3F4F6',
    border: 'none',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#374151',
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    flex: 1,
    background: '#EF4444',
    border: 'none',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
  },

  // Budgets View
  budgetsView: {
    padding: '24px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  budgetsHeader: {
    marginBottom: '28px',
  },
  budgetsTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#111827',
  },
  budgetsSubtitle: {
    color: '#6B7280',
    margin: 0,
  },
  budgetsList: {
    display: 'grid',
    gap: '12px',
    marginBottom: '24px',
  },
  budgetRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff',
    borderRadius: '16px',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  budgetInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  budgetIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
  },
  budgetName: {
    display: 'block',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#374151',
  },
  budgetSpent: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#9CA3AF',
    marginTop: '2px',
  },
  budgetInputGroup: {
    display: 'flex',
    alignItems: 'center',
    background: '#F3F4F6',
    borderRadius: '10px',
    padding: '10px 14px',
  },
  budgetDollar: {
    color: '#9CA3AF',
    marginRight: '4px',
    fontWeight: '500',
  },
  budgetInput: {
    background: 'none',
    border: 'none',
    width: '80px',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1F2937',
    outline: 'none',
  },
  budgetSummary: {
    background: '#F9FAFB',
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '20px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1rem',
    color: '#6B7280',
  },
  summaryValue: {
    fontWeight: '700',
    color: '#111827',
    fontSize: '1.25rem',
  },
  saveBudgetsBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #A78BFA, #EC4899)',
    color: '#fff',
    border: 'none',
    padding: '16px',
    borderRadius: '14px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(167, 139, 250, 0.4)',
  },
};

// Add animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  * { box-sizing: border-box; }
`;
document.head.appendChild(styleSheet);
