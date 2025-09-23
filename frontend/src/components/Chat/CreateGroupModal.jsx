import React, { useState } from 'react';
import { X, Users, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const { createNewGroup } = useAuth();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Ảnh không được vượt quá 5MB');
        return;
      }
      
      setGroupPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => setGroupPhotoPreview(e.target.result);
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      setError('Vui lòng nhập tên nhóm');
      return;
    }

    if (groupName.length < 3) {
      setError('Tên nhóm phải có ít nhất 3 ký tự');
      return;
    }

    if (groupName.length > 50) {
      setError('Tên nhóm không được vượt quá 50 ký tự');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // TODO: Upload group photo if exists
      let groupPhotoUrl = null;
      if (groupPhoto) {
        // For now, we'll skip photo upload
        // groupPhotoUrl = await uploadGroupPhoto(groupPhoto);
      }

      const result = await createNewGroup(groupName.trim(), groupPhotoUrl);
      
      if (result.success) {
        handleClose();
      } else {
        setError(result.error || 'Có lỗi xảy ra khi tạo nhóm');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      setError('Có lỗi xảy ra khi tạo nhóm');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setGroupPhoto(null);
    setGroupPhotoPreview(null);
    setError('');
    setIsCreating(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Tạo nhóm mới
          </h2>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Group Photo */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {groupPhotoPreview ? (
                  <img 
                    src={groupPhotoPreview} 
                    alt="Group preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 bg-blue-600 p-1.5 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                <Camera className="w-3 h-3 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  disabled={isCreating}
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">Ảnh nhóm (tùy chọn)</p>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tên nhóm *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nhập tên nhóm..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={isCreating}
              maxLength={50}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Ít nhất 3 ký tự</span>
              <span>{groupName.length}/50</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreating || !groupName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                'Tạo nhóm'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;