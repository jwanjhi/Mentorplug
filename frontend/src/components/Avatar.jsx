import React, { useRef, useState } from 'react';
import api from '../services/api';

const BASE_URL = 'http://localhost:5000';

/**
 * Avatar component
 *
 * Props:
 *  - avatarUrl   string|null   URL from DB (e.g. "/uploads/avatars/avatar_3.jpg")
 *  - name        string        Full name, used to derive initials fallback
 *  - size        number        px size of the circle (default 56)
 *  - editable    bool          Shows camera overlay and triggers upload on click
 *  - onUpload    fn(newUrl)    Called after a successful upload with the new avatarUrl
 */
export default function Avatar({ avatarUrl, name = '', size = 56, editable = false, onUpload }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState(null); // optimistic preview

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const displayUrl = localUrl || (avatarUrl ? `${BASE_URL}${avatarUrl}` : null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimistic preview
    const objectUrl = URL.createObjectURL(file);
    setLocalUrl(objectUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/profiles/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLocalUrl(null); // let the real URL take over
      onUpload?.(res.data.avatarUrl);
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setLocalUrl(null); // revert preview on error
      alert(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Clear the input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fontSize = Math.round(size * 0.36);

  return (
    <>
      <div
        onClick={() => editable && fileInputRef.current?.click()}
        style={{
          width:        size,
          height:       size,
          minWidth:     size,
          borderRadius: '50%',
          background:   displayUrl ? 'transparent' : 'linear-gradient(135deg, var(--mp-navy), #25397A)',
          border:       '2px solid var(--mp-gold)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontWeight:   700,
          fontSize:     fontSize,
          color:        'var(--mp-gold)',
          boxShadow:    '0 4px 12px rgba(0,0,0,0.2)',
          position:     'relative',
          overflow:     'hidden',
          cursor:       editable ? 'pointer' : 'default',
          flexShrink:   0,
          transition:   'opacity 0.2s',
          opacity:      uploading ? 0.6 : 1,
        }}
        title={editable ? 'Click to change photo' : undefined}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={`${name} avatar`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          />
        ) : (
          initials
        )}

        {/* Camera overlay on hover (editable only) */}
        {editable && (
          <div
            style={{
              position:        'absolute',
              inset:           0,
              borderRadius:    '50%',
              background:      'rgba(0,0,0,0.45)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              opacity:         0,
              transition:      'opacity 0.2s',
            }}
            className="avatar-edit-overlay"
          >
            {uploading ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </div>
        )}
      </div>

      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      {/* Inline style for hover overlay + spinner */}
      <style>{`
        .avatar-edit-overlay { pointer-events: none; }
        div:hover > .avatar-edit-overlay { opacity: 1 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
