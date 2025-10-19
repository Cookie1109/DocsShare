import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { auth } from '../../config/firebase';

const OnboardingModal = ({ isOpen, onComplete }) => {
  const [formData, setFormData] = useState({
    displayName: '',
    tag: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tagAvailable, setTagAvailable] = useState(null);
  const [checkingTag, setCheckingTag] = useState(false);
  
  const displayNameRef = useRef(null);
  const checkTagTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({ displayName: '', tag: '' });
      setError('');
      setTagAvailable(null);
      
      // Auto-focus display name input
      setTimeout(() => displayNameRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-check tag availability when user types
  useEffect(() => {
    if (formData.displayName && formData.tag && formData.tag.length >= 4) {
      // Clear previous timeout
      if (checkTagTimeoutRef.current) {
        clearTimeout(checkTagTimeoutRef.current);
      }
      
      // Debounce tag check
      checkTagTimeoutRef.current = setTimeout(() => {
        checkTagAvailability();
      }, 500);
    } else {
      setTagAvailable(null);
    }
    
    return () => {
      if (checkTagTimeoutRef.current) {
        clearTimeout(checkTagTimeoutRef.current);
      }
    };
  }, [formData.displayName, formData.tag]);

  const checkTagAvailability = async () => {
    if (!formData.displayName || !formData.tag) return;
    
    setCheckingTag(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(
        `http://localhost:5000/api/profile/check-tag/${formData.tag}?displayName=${encodeURIComponent(formData.displayName)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      setTagAvailable(data.available);
      
      if (!data.available) {
        setError(data.message || 'Tên và tag đã được sử dụng');
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Error checking tag:', err);
    } finally {
      setCheckingTag(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For tag field, only allow digits
    if (name === 'tag') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({ ...prev, [name]: digitsOnly }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    setError('');
  };

  const validateForm = () => {
    if (!formData.displayName.trim()) {
      setError('Vui lòng nhập tên hiển thị');
      return false;
    }
    
    if (formData.displayName.trim().length < 2) {
      setError('Tên hiển thị phải có ít nhất 2 ký tự');
      return false;
    }
    
    if (!formData.tag) {
      setError('Vui lòng nhập tag');
      return false;
    }
    
    if (formData.tag.length < 4 || formData.tag.length > 6) {
      setError('Tag phải có từ 4-6 chữ số');
      return false;
    }
    
    if (tagAvailable === false) {
      setError('Tên và tag đã được sử dụng. Vui lòng chọn tag khác');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('http://localhost:5000/api/profile/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: formData.displayName.trim(),
          tag: formData.tag
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reload to refresh user data
        await auth.currentUser.reload();
        onComplete();
      } else {
        setError(data.error || 'Không thể hoàn tất hồ sơ');
      }
    } catch (err) {
      console.error('Error completing profile:', err);
      setError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop - no click to close for required onboarding */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Chào mừng đến DocsShare!
            </h2>
            <p className="text-gray-600 text-sm">
              Vui lòng thiết lập tên hiển thị và tag của bạn
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name Field */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                Tên hiển thị <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={displayNameRef}
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Ví dụ: Cookie"
                  maxLength={50}
                />
              </div>
            </div>

            {/* Tag Field */}
            <div>
              <label htmlFor="tag" className="block text-sm font-medium text-gray-700 mb-2">
                Tag <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 text-sm font-medium">#</span>
                </div>
                <input
                  id="tag"
                  name="tag"
                  type="text"
                  value={formData.tag}
                  onChange={handleChange}
                  className={`block w-full pl-8 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    tagAvailable === false ? 'border-red-300' : 
                    tagAvailable === true ? 'border-green-300' : 'border-gray-300'
                  }`}
                  placeholder="Ví dụ: 1109"
                  maxLength={6}
                />
                {/* Tag status indicator */}
                {checkingTag ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Loader className="h-5 w-5 text-gray-400 animate-spin" />
                  </div>
                ) : tagAvailable === true ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                ) : tagAvailable === false ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Tag phải có từ 4-6 chữ số
              </p>
            </div>

            {/* Username Preview */}
            {formData.displayName && formData.tag && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Tài khoản của bạn: </span>
                  <span className="font-mono font-semibold">
                    {formData.displayName}#{formData.tag}
                  </span>
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || checkingTag || tagAvailable === false}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                'Hoàn tất'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default OnboardingModal;
