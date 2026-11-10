import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, ProgressBar, Badge, Spinner, Alert } from 'react-bootstrap';
import api from '../services/api';

const SMART_PRESETS = [
  {
    title: 'Career & Technical Roadmap Setup',
    description: 'Establish core learning targets, tech stack focus, and monthly checkpoints.',
    targetDays: 7,
    tasks: [
      'Define top 3 technical skills to master',
      'Select capstone project topic & architecture',
      'Schedule bi-weekly mentorship check-in',
    ],
  },
  {
    title: 'Code Review & Engineering Best Practices',
    description: 'Perform deep-dive peer reviews on codebase architecture, security, and testing.',
    targetDays: 21,
    tasks: [
      'Conduct PR review on core database schema',
      'Implement automated integration testing',
      'Refactor error handling & logging patterns',
    ],
  },
  {
    title: 'Portfolio Polish & Interview Readiness',
    description: 'Prepare production-ready code samples, resume impact statements, and mock scenarios.',
    targetDays: 30,
    tasks: [
      'Document system design and live deployment link',
      'Refactor resume bullet points to highlight project impact',
      'Complete 45-minute mock technical interview',
    ],
  },
];

export default function MentorshipProgressModal({ show, onHide, match, currentUser }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    goals: [],
    stats: { percentage: 0, totalGoals: 0, completedGoals: 0, pendingReviewGoals: 0, totalTasks: 0, completedTasks: 0 },
    partner: null,
    isMentor: false,
  });
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Milestone creation form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formTasks, setFormTasks] = useState(['', '']);
  const [savingGoal, setSavingGoal] = useState(false);

  // Inline new task state per goal
  const [inlineTaskText, setInlineTaskText] = useState({});
  const [addingTaskForGoal, setAddingTaskForGoal] = useState(null);

  // Mentor Review Modal state
  const [reviewGoalTarget, setReviewGoalTarget] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('approve'); // 'approve' | 'request_changes'
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const matchId = match?.matchid || match?.matchID;

  // Determine if current user is the mentor for this match
  const isMentor = Boolean(
    data.isMentor ||
    currentUser?.role === 'mentor' ||
    match?.mentor?.accountID === currentUser?.accountID
  );

  // Fetch progress data whenever modal opens
  useEffect(() => {
    if (show && matchId) {
      fetchProgress();
      setShowAddForm(false);
      setEditingGoalId(null);
      setReviewGoalTarget(null);
      setError(null);
      setSuccessMsg(null);
    }
  }, [show, matchId]);

  const fetchProgress = async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/progress/${matchId}`);
      setData(res.data);
    } catch (err) {
      console.error('Fetch progress error:', err);
      setError(err.response?.data?.error || 'Failed to load mentorship progress.');
    } finally {
      setLoading(false);
    }
  };

  // Reset form fields
  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTargetDate('');
    setFormTasks(['', '']);
    setEditingGoalId(null);
    setShowAddForm(false);
  };

  // Populate form for editing existing goal
  const handleStartEdit = (goal) => {
    setEditingGoalId(goal.goalID);
    setFormTitle(goal.title);
    setFormDescription(goal.description || '');
    setFormTargetDate(goal.target_date || '');
    setFormTasks([]);
    setShowAddForm(true);
  };

  // Quick-apply a smart preset
  const handleApplyPreset = (preset) => {
    const today = new Date();
    today.setDate(today.getDate() + preset.targetDays);
    const dateStr = today.toISOString().split('T')[0];

    setEditingGoalId(null);
    setFormTitle(preset.title);
    setFormDescription(preset.description);
    setFormTargetDate(dateStr);
    setFormTasks([...preset.tasks]);
    setShowAddForm(true);
  };

  // Form task list handlers
  const handleTaskChange = (index, value) => {
    const next = [...formTasks];
    next[index] = value;
    setFormTasks(next);
  };

  const handleAddTaskField = () => {
    setFormTasks([...formTasks, '']);
  };

  const handleRemoveTaskField = (index) => {
    setFormTasks(formTasks.filter((_, i) => i !== index));
  };

  // Save new or edited goal
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('Please provide a milestone title.');
      return;
    }

    setSavingGoal(true);
    setError(null);

    try {
      if (editingGoalId) {
        // Update existing goal
        await api.patch(`/progress/goals/${editingGoalId}`, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          target_date: formTargetDate || null,
        });
        setSuccessMsg('Milestone updated successfully.');
      } else {
        // Create new goal
        const validTasks = formTasks.map((t) => t.trim()).filter(Boolean);
        await api.post(`/progress/${matchId}`, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          target_date: formTargetDate || null,
          tasks: validTasks,
        });
        setSuccessMsg('New milestone & action items added!');
      }

      resetForm();
      await fetchProgress();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Save goal error:', err);
      setError(err.response?.data?.error || 'Failed to save milestone.');
    } finally {
      setSavingGoal(false);
    }
  };

  // Delete a goal
  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this milestone and all its action items?')) {
      return;
    }
    try {
      await api.delete(`/progress/goals/${goalId}`);
      await fetchProgress();
      setSuccessMsg('Milestone removed.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete milestone.');
    }
  };

  // Mentee submits milestone for mentor review
  const handleSubmitForReview = async (goal) => {
    try {
      await api.patch(`/progress/goals/${goal.goalID}`, { status: 'pending_review' });
      await fetchProgress();
      setSuccessMsg(`"${goal.title}" submitted! Your mentor has been notified for review.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit milestone for review.');
    }
  };

  // Open review modal for mentor
  const handleOpenReviewModal = (goal, decision = 'approve') => {
    setReviewGoalTarget(goal);
    setReviewDecision(decision);
    setReviewNotes(decision === 'approve' ? 'Great work! All objectives verified.' : '');
  };

  // Mentor submits decision (approve or request changes)
  const handleConfirmReview = async (e) => {
    e.preventDefault();
    if (!reviewGoalTarget) return;

    setSubmittingReview(true);
    setError(null);

    try {
      await api.post(`/progress/goals/${reviewGoalTarget.goalID}/review`, {
        decision: reviewDecision,
        notes: reviewNotes.trim(),
      });

      setSuccessMsg(
        reviewDecision === 'approve'
          ? `✓ Milestone "${reviewGoalTarget.title}" approved and verified!`
          : `↺ Revision requested for "${reviewGoalTarget.title}". Mentee notified.`
      );
      setReviewGoalTarget(null);
      await fetchProgress();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Review submit error:', err);
      setError(err.response?.data?.error || 'Failed to submit review decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Toggle action item completion
  const handleToggleItem = async (itemId) => {
    try {
      const res = await api.patch(`/progress/items/${itemId}/toggle`);
      await fetchProgress();
      if (res.data?.isPendingReview) {
        setSuccessMsg('All tasks completed! Milestone submitted to your mentor for sign-off.');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update task.');
    }
  };

  // Add inline action item to existing goal
  const handleAddInlineItem = async (goalId) => {
    const text = (inlineTaskText[goalId] || '').trim();
    if (!text) return;

    setAddingTaskForGoal(goalId);
    try {
      await api.post(`/progress/goals/${goalId}/items`, { task_text: text });
      setInlineTaskText({ ...inlineTaskText, [goalId]: '' });
      await fetchProgress();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add task.');
    } finally {
      setAddingTaskForGoal(null);
    }
  };

  // Delete action item
  const handleDeleteItem = async (itemId) => {
    try {
      await api.delete(`/progress/items/${itemId}`);
      await fetchProgress();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete task.');
    }
  };

  const partnerName = data.partner?.name || match?.mentor?.name || match?.mentee?.name || 'Partner';
  const partnerRole = data.partner?.role || (isMentor ? 'Mentee' : 'Mentor');
  const stats = data.stats || {
    percentage: 0,
    totalGoals: 0,
    completedGoals: 0,
    pendingReviewGoals: 0,
    totalTasks: 0,
    completedTasks: 0,
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg" centered contentClassName="card-glass-custom border-0 p-0 overflow-hidden shadow-lg">
        {/* Modal Header */}
        <Modal.Header closeButton closeVariant="white" className="border-0 px-4 pt-4 pb-2" style={{ background: 'var(--mp-bg-surface)' }}>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span className="tag-gold-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.65rem' }}>
                🎯 Mentorship Lifecycle &amp; Verification
              </span>
              <Badge bg="dark" className="border border-secondary fw-normal text-muted" style={{ fontSize: '0.75rem' }}>
                {isMentor ? '👨‍🏫 Mentor Evaluation View' : '🎓 Mentee Execution View'}
              </Badge>
            </div>
            <h5 className="fw-bold text-themed-primary mb-0">
              Milestones &amp; Progress with {partnerName} <span className="small text-gold fw-normal">({partnerRole})</span>
            </h5>
          </div>
        </Modal.Header>

        <Modal.Body className="px-4 py-3" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2 small">
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert variant="success" dismissible onClose={() => setSuccessMsg(null)} className="py-2 small">
              {successMsg}
            </Alert>
          )}

          {/* Progress Overview Card */}
          <div
            className="p-3 mb-4 rounded-3"
            style={{
              background: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(13,27,75,0.4) 100%)',
              border: '1.5px solid var(--mp-gold-border)',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
              <div>
                <span className="small text-gold fw-semibold text-uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  Verified Mentorship Progress
                </span>
                <div className="d-flex align-items-baseline gap-2">
                  <h2 className="fw-bold mb-0 text-themed-primary">{stats.percentage}%</h2>
                  <span className="small text-themed-secondary">
                    ({stats.completedTasks} of {stats.totalTasks} tasks finished • {stats.completedGoals} of {stats.totalGoals} milestones approved)
                  </span>
                </div>
              </div>
              <div className="d-flex gap-2">
                <div
                  className="px-3 py-1 rounded-pill text-center"
                  style={{ background: 'var(--mp-bg-surface)', border: '1px solid var(--mp-border-subtle)' }}
                >
                  <div className="fw-bold text-gold" style={{ fontSize: '0.9rem' }}>
                    {stats.completedGoals} / {stats.totalGoals}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                    Approved
                  </div>
                </div>
                {stats.pendingReviewGoals > 0 && (
                  <div
                    className="px-3 py-1 rounded-pill text-center"
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #F59E0B' }}
                  >
                    <div className="fw-bold text-warning" style={{ fontSize: '0.9rem' }}>
                      {stats.pendingReviewGoals}
                    </div>
                    <div className="text-warning" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                      In Review
                    </div>
                  </div>
                )}
                <div
                  className="px-3 py-1 rounded-pill text-center"
                  style={{ background: 'var(--mp-bg-surface)', border: '1px solid var(--mp-border-subtle)' }}
                >
                  <div className="fw-bold text-success" style={{ fontSize: '0.9rem' }}>
                    {stats.completedTasks} / {stats.totalTasks}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                    Tasks
                  </div>
                </div>
              </div>
            </div>

            <ProgressBar
              now={stats.percentage}
              variant="warning"
              style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Top Action Bar */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
              <h6 className="fw-bold text-themed-primary mb-0">
                Milestones &amp; Learning Objectives ({data.goals?.length || 0})
              </h6>
              <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                {isMentor
                  ? 'As a mentor, your sign-off is required to verify completed milestones.'
                  : 'Complete checklist tasks and submit for your mentor’s verification.'}
              </span>
            </div>
            <Button
              size="sm"
              className="btn-gold d-flex align-items-center gap-1"
              onClick={() => {
                if (showAddForm) resetForm();
                else setShowAddForm(true);
              }}
            >
              <span>{showAddForm ? '✕ Close Form' : '+ Add Milestone'}</span>
            </Button>
          </div>

          {/* Add / Edit Milestone Form */}
          {showAddForm && (
            <div
              className="p-3 mb-4 rounded-3 border"
              style={{
                background: 'var(--mp-bg-surface)',
                borderColor: 'var(--mp-gold-border)',
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold text-gold small">
                  {editingGoalId ? '✏️ Edit Milestone' : '✦ New Mentorship Milestone'}
                </span>
                <button
                  type="button"
                  className="btn-close btn-close-white small"
                  onClick={resetForm}
                  aria-label="Close"
                />
              </div>

              <Form onSubmit={handleSaveGoal}>
                <Form.Group className="mb-2">
                  <Form.Label className="small text-themed-secondary mb-1">
                    Milestone Title <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. System Architecture & ERD Finalization"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    style={{
                      background: 'var(--mp-bg-input)',
                      color: 'var(--mp-text-primary)',
                      borderColor: 'var(--mp-border-subtle)',
                      borderRadius: 'var(--mp-radius-input)',
                    }}
                  />
                </Form.Group>

                <div className="row g-2 mb-2">
                  <div className="col-md-7">
                    <Form.Group>
                      <Form.Label className="small text-themed-secondary mb-1">
                        Objective / Notes (Optional)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Brief notes or expected learning outcomes"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        style={{
                          background: 'var(--mp-bg-input)',
                          color: 'var(--mp-text-primary)',
                          borderColor: 'var(--mp-border-subtle)',
                          borderRadius: 'var(--mp-radius-input)',
                        }}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-5">
                    <Form.Group>
                      <Form.Label className="small text-themed-secondary mb-1">
                        Target Completion Date
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={formTargetDate}
                        onChange={(e) => setFormTargetDate(e.target.value)}
                        style={{
                          background: 'var(--mp-bg-input)',
                          color: 'var(--mp-text-primary)',
                          borderColor: 'var(--mp-border-subtle)',
                          borderRadius: 'var(--mp-radius-input)',
                        }}
                      />
                    </Form.Group>
                  </div>
                </div>

                {/* Action Items List in Creation Form (Only on new goal) */}
                {!editingGoalId && (
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Form.Label className="small text-themed-secondary mb-0">
                        Action Checklist Items
                      </Form.Label>
                      <Button
                        variant="link"
                        className="p-0 text-gold small text-decoration-none"
                        onClick={handleAddTaskField}
                      >
                        + Add Task
                      </Button>
                    </div>
                    {formTasks.map((task, idx) => (
                      <div key={idx} className="d-flex align-items-center gap-2 mb-1">
                        <span className="small text-muted">{idx + 1}.</span>
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder={`Action task ${idx + 1}`}
                          value={task}
                          onChange={(e) => handleTaskChange(idx, e.target.value)}
                          style={{
                            background: 'var(--mp-bg-input)',
                            color: 'var(--mp-text-primary)',
                            borderColor: 'var(--mp-border-subtle)',
                            borderRadius: 'var(--mp-radius-input)',
                          }}
                        />
                        {formTasks.length > 1 && (
                          <Button
                            variant="link"
                            className="text-danger p-0"
                            onClick={() => handleRemoveTaskField(idx)}
                            style={{ textDecoration: 'none' }}
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="d-flex justify-content-end gap-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={resetForm}
                    style={{ borderRadius: 'var(--mp-radius-pill)' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    className="btn-gold"
                    disabled={savingGoal}
                    style={{ borderRadius: 'var(--mp-radius-pill)' }}
                  >
                    {savingGoal ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-1" />
                        Saving...
                      </>
                    ) : editingGoalId ? (
                      'Save Changes'
                    ) : (
                      'Create Milestone'
                    )}
                  </Button>
                </div>
              </Form>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className="text-center py-5">
              <Spinner animation="border" variant="warning" />
              <div className="small text-themed-secondary mt-2">Loading milestones and verification status...</div>
            </div>
          )}

          {/* Empty State with Smart Presets */}
          {!loading && (!data.goals || data.goals.length === 0) && !showAddForm && (
            <div
              className="text-center py-4 px-3 rounded-3 mb-3"
              style={{
                background: 'var(--mp-bg-surface)',
                border: '1px dashed var(--mp-border-subtle)',
              }}
            >
              <div style={{ fontSize: '2.5rem' }}>🌱</div>
              <h6 className="fw-bold text-themed-primary mt-2">No Milestones Set Yet</h6>
              <p className="small text-themed-secondary mb-3" style={{ maxWidth: '440px', margin: '0 auto' }}>
                Kickstart your mentorship by setting clear SMART milestones. Once tasks are completed, the mentor signs off to verify progress.
              </p>

              <div className="row g-2 text-start mt-2">
                {SMART_PRESETS.map((preset, idx) => (
                  <div key={idx} className="col-md-4">
                    <div
                      className="p-3 rounded-3 h-100 d-flex flex-column justify-content-between"
                      style={{
                        background: 'rgba(201,168,76,0.06)',
                        border: '1px solid var(--mp-gold-border)',
                      }}
                    >
                      <div>
                        <div className="fw-bold text-gold small mb-1">{preset.title}</div>
                        <p className="text-muted mb-2" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                          {preset.description}
                        </p>
                        <ul className="ps-3 mb-2" style={{ fontSize: '0.72rem', color: 'var(--mp-text-secondary)' }}>
                          {preset.tasks.map((t, ti) => (
                            <li key={ti}>{t}</li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        size="sm"
                        className="btn-outline-gold w-100 mt-2"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--mp-radius-pill)' }}
                        onClick={() => handleApplyPreset(preset)}
                      >
                        ✦ Use Template
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Goals List */}
          {!loading && data.goals && data.goals.length > 0 && (
            <div className="d-flex flex-column gap-3">
              {data.goals.map((goal) => {
                const isCompleted = goal.status === 'completed';
                const isPendingReview = goal.status === 'pending_review';
                const items = goal.action_items || [];
                const itemsDone = items.filter((i) => i.is_completed).length;
                const goalPercent = items.length > 0 ? Math.round((itemsDone / items.length) * 100) : isCompleted ? 100 : 0;

                return (
                  <div
                    key={goal.goalID}
                    className="p-3 rounded-3 transition-all"
                    style={{
                      background: 'var(--mp-bg-surface)',
                      border: `1.5px solid ${
                        isCompleted
                          ? 'rgba(34,197,94,0.4)'
                          : isPendingReview
                          ? '#F59E0B'
                          : 'var(--mp-border-subtle)'
                      }`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Goal Header */}
                    <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        {/* Checkmark or Status Icon */}
                        <div
                          className="d-flex align-items-center justify-content-center"
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: isCompleted ? '#22C55E' : isPendingReview ? 'rgba(245,158,11,0.2)' : 'transparent',
                            border: `2px solid ${isCompleted ? '#22C55E' : isPendingReview ? '#F59E0B' : 'var(--mp-gold)'}`,
                            color: isCompleted ? '#FFFFFF' : '#F59E0B',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                          }}
                        >
                          {isCompleted ? '✓' : isPendingReview ? '⏳' : '○'}
                        </div>

                        <h6
                          className={`fw-bold mb-0 ${isCompleted ? 'text-decoration-line-through text-muted' : 'text-themed-primary'}`}
                        >
                          {goal.title}
                        </h6>

                        {/* Status Badge */}
                        {isCompleted && (
                          <Badge bg="success" className="fw-semibold" style={{ fontSize: '0.72rem' }}>
                            ✓ Mentor Approved
                          </Badge>
                        )}
                        {isPendingReview && (
                          <Badge bg="warning" text="dark" className="fw-bold" style={{ fontSize: '0.72rem', background: '#F59E0B' }}>
                            ⏳ Awaiting Mentor Approval
                          </Badge>
                        )}
                        {!isCompleted && !isPendingReview && (
                          <Badge bg="secondary" className="fw-normal" style={{ fontSize: '0.72rem' }}>
                            In Progress
                          </Badge>
                        )}
                      </div>

                      <div className="d-flex align-items-center gap-1">
                        {goal.target_date && (
                          <span
                            className="small me-2"
                            style={{
                              color: isCompleted ? 'var(--mp-text-muted)' : 'var(--mp-gold)',
                              fontSize: '0.78rem',
                            }}
                          >
                            📅 Target: {goal.target_date}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="link"
                          className="p-1 text-themed-secondary"
                          onClick={() => handleStartEdit(goal)}
                          title="Edit milestone"
                          style={{ textDecoration: 'none' }}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="link"
                          className="p-1 text-danger"
                          onClick={() => handleDeleteGoal(goal.goalID)}
                          title="Delete milestone"
                          style={{ textDecoration: 'none' }}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>

                    {/* Goal Description */}
                    {goal.description && (
                      <p className="small text-themed-secondary mb-2 fst-italic">
                        {goal.description}
                      </p>
                    )}

                    {/* Mentor Sign-off note if approved */}
                    {isCompleted && goal.review_notes && (
                      <div
                        className="p-2 mb-2 rounded-2"
                        style={{
                          background: 'rgba(34,197,94,0.08)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span className="fw-bold text-success">Mentor Sign-off Note:</span>{' '}
                        <span className="text-themed-primary fst-italic">"{goal.review_notes}"</span>
                      </div>
                    )}

                    {/* Mentor Revision Note if in progress */}
                    {!isCompleted && !isPendingReview && goal.review_notes && (
                      <div
                        className="p-2 mb-2 rounded-2"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span className="fw-bold text-danger">⚠️ Mentor Requested Revision:</span>{' '}
                        <span className="text-themed-primary fst-italic">"{goal.review_notes}"</span>
                      </div>
                    )}

                    {/* Review Callout Banner for Mentor when Pending Review */}
                    {isPendingReview && isMentor && (
                      <div
                        className="p-3 mb-2 rounded-3"
                        style={{
                          background: 'rgba(201,168,76,0.1)',
                          border: '1.5px solid var(--mp-gold)',
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <div>
                            <span className="fw-bold text-gold small d-block">
                              📋 Mentee Submitted This Milestone for Review
                            </span>
                            <span className="text-themed-secondary" style={{ fontSize: '0.75rem' }}>
                              Inspect completed tasks and verify learning outcomes before approving.
                            </span>
                          </div>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              className="btn-gold d-flex align-items-center gap-1"
                              onClick={() => handleOpenReviewModal(goal, 'approve')}
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--mp-radius-pill)' }}
                            >
                              ✓ Approve Milestone
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              className="btn-outline-gold"
                              onClick={() => handleOpenReviewModal(goal, 'request_changes')}
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--mp-radius-pill)' }}
                            >
                              ↺ Request Revision
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mentee Pending Review Banner */}
                    {isPendingReview && !isMentor && (
                      <div
                        className="p-2 mb-2 rounded-2 d-flex align-items-center gap-2"
                        style={{
                          background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.3)',
                          fontSize: '0.78rem',
                          color: '#F59E0B',
                        }}
                      >
                        <span>⏳</span>
                        <span>All tasks submitted for mentor verification. Your mentor has been notified to inspect and approve!</span>
                      </div>
                    )}

                    {/* Mini Progress Bar for this goal */}
                    {items.length > 0 && (
                      <div className="mb-2">
                        <div className="d-flex justify-content-between small text-muted mb-1" style={{ fontSize: '0.72rem' }}>
                          <span>Checklist completion</span>
                          <span>
                            {itemsDone} / {items.length} tasks completed ({goalPercent}%)
                          </span>
                        </div>
                        <ProgressBar
                          now={goalPercent}
                          variant={isCompleted ? 'success' : isPendingReview ? 'warning' : 'warning'}
                          style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}
                        />
                      </div>
                    )}

                    {/* Action Items Checklist */}
                    <div className="ps-2 pt-2 border-top" style={{ borderColor: 'var(--mp-border-subtle)' }}>
                      {items.map((item) => (
                        <div
                          key={item.itemID}
                          className="d-flex align-items-center justify-content-between py-1 px-2 rounded hover-bg"
                          style={{ fontSize: '0.82rem' }}
                        >
                          <div
                            className="d-flex align-items-center gap-2 cursor-pointer flex-grow-1"
                            onClick={() => handleToggleItem(item.itemID)}
                            style={{ cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={item.is_completed}
                              onChange={() => {}} // Controlled by row click
                              className="form-check-input mt-0"
                              style={{ cursor: 'pointer', accentColor: 'var(--mp-gold)' }}
                            />
                            <span
                              className={item.is_completed ? 'text-decoration-line-through text-muted' : 'text-themed-primary'}
                            >
                              {item.task_text}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link text-muted p-0 ms-2 small"
                            onClick={() => handleDeleteItem(item.itemID)}
                            title="Remove item"
                            style={{ textDecoration: 'none', fontSize: '0.85rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {/* Inline Task Add Input */}
                      <div className="d-flex align-items-center gap-2 mt-2 pt-1">
                        <Form.Control
                          size="sm"
                          type="text"
                          placeholder="+ Add an action item to this milestone..."
                          value={inlineTaskText[goal.goalID] || ''}
                          onChange={(e) =>
                            setInlineTaskText({ ...inlineTaskText, [goal.goalID]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddInlineItem(goal.goalID);
                            }
                          }}
                          style={{
                            background: 'var(--mp-bg-input)',
                            color: 'var(--mp-text-primary)',
                            borderColor: 'var(--mp-border-subtle)',
                            borderRadius: 'var(--mp-radius-input)',
                            fontSize: '0.8rem',
                          }}
                        />
                        <Button
                          size="sm"
                          className="btn-gold text-nowrap"
                          disabled={addingTaskForGoal === goal.goalID || !(inlineTaskText[goal.goalID] || '').trim()}
                          onClick={() => handleAddInlineItem(goal.goalID)}
                          style={{ fontSize: '0.78rem', borderRadius: 'var(--mp-radius-pill)' }}
                        >
                          {addingTaskForGoal === goal.goalID ? 'Adding...' : 'Add'}
                        </Button>
                      </div>

                      {/* Bottom Milestone Action Bar (Submit for Review or Direct Sign-Off) */}
                      {!isCompleted && (
                        <div className="d-flex justify-content-end align-items-center gap-2 mt-2 pt-2 border-top" style={{ borderColor: 'var(--mp-border-subtle)' }}>
                          {!isMentor && !isPendingReview && (
                            <Button
                              size="sm"
                              className="btn-gold"
                              onClick={() => handleSubmitForReview(goal)}
                              style={{ fontSize: '0.75rem', padding: '0.28rem 0.75rem', borderRadius: 'var(--mp-radius-pill)' }}
                            >
                              📨 Submit for Mentor Review
                            </Button>
                          )}
                          {isMentor && (
                            <Button
                              size="sm"
                              className="btn-gold"
                              onClick={() => handleOpenReviewModal(goal, 'approve')}
                              style={{ fontSize: '0.75rem', padding: '0.28rem 0.75rem', borderRadius: 'var(--mp-radius-pill)' }}
                            >
                              ✓ Sign Off &amp; Approve
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="border-0 px-4 py-3" style={{ background: 'var(--mp-bg-surface)' }}>
          <div className="d-flex justify-content-between align-items-center w-100">
            <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
              {isMentor
                ? 'Mentors verify task completion before progress is certified.'
                : 'Complete your checklist and submit to your mentor for sign-off.'}
            </span>
            <Button variant="outline-secondary" size="sm" onClick={onHide} style={{ borderRadius: 'var(--mp-radius-pill)' }}>
              Close
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Mentor Review Decision Modal */}
      {reviewGoalTarget && (
        <Modal
          show={Boolean(reviewGoalTarget)}
          onHide={() => setReviewGoalTarget(null)}
          centered
          size="md"
          contentClassName="card-glass-custom border-0 p-0 overflow-hidden shadow-lg"
        >
          <Modal.Header closeButton closeVariant="white" className="border-0 px-4 pt-4 pb-2" style={{ background: 'var(--mp-bg-surface)' }}>
            <Modal.Title className="h6 fw-bold text-themed-primary mb-0">
              {reviewDecision === 'approve' ? '✓ Approve Milestone' : '↺ Request Milestone Revision'}
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleConfirmReview}>
            <Modal.Body className="px-4 py-3">
              <p className="small text-themed-secondary mb-3">
                Milestone: <strong className="text-gold">{reviewGoalTarget.title}</strong>
              </p>

              <Form.Group className="mb-3">
                <Form.Label className="small text-themed-secondary mb-1">
                  {reviewDecision === 'approve'
                    ? 'Mentor Sign-Off Notes / Praise (Optional)'
                    : 'Constructive Feedback & Required Changes *'}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  required={reviewDecision === 'request_changes'}
                  placeholder={
                    reviewDecision === 'approve'
                      ? 'e.g. Excellent work! Schema is fully normalized and meets all requirements.'
                      : 'e.g. Please add foreign key indexes and review the API payload structure before we finalize.'
                  }
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  style={{
                    background: 'var(--mp-bg-input)',
                    color: 'var(--mp-text-primary)',
                    borderColor: 'var(--mp-border-subtle)',
                    borderRadius: 'var(--mp-radius-input)',
                    fontSize: '0.85rem',
                  }}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-0 px-4 pb-4 pt-1" style={{ background: 'var(--mp-bg-surface)' }}>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setReviewGoalTarget(null)}
                style={{ borderRadius: 'var(--mp-radius-pill)' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="btn-gold"
                disabled={submittingReview || (reviewDecision === 'request_changes' && !reviewNotes.trim())}
                style={{ borderRadius: 'var(--mp-radius-pill)' }}
              >
                {submittingReview ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-1" />
                    Submitting...
                  </>
                ) : reviewDecision === 'approve' ? (
                  'Confirm & Approve'
                ) : (
                  'Send Revision Request'
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </>
  );
}
