import { useState, useRef } from 'react';
import { Edit2, Check, X, Camera, Users, Calendar } from 'lucide-react';

const GroupInfo = ({ group, currentUser, isAdmin, onGroupUpdate }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [newDescription, setNewDescription] = useState(group.description || '');
  const fileInputRef = useRef(null);

  const handleSaveName = () => {
    if (newName.trim() && newName !== group.name) {
      onGroupUpdate?.({ ...group, name: newName.trim() });
    }
    setIsEditingName(false);
  };

  const handleSaveDescription = () => {
    if (newDescription !== group.description) {
      onGroupUpdate?.({ ...group, description: newDescription.trim() });
    }
    setIsEditingDescription(false);
  };

  const handleCancelName = () => {
    setNewName(group.name);
    setIsEditingName(false);
  };

  const handleCancelDescription = () => {
    setNewDescription(group.description || '');
    setIsEditingDescription(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onGroupUpdate?.({ ...group, avatar: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Group Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center overflow-hidden">
            {group.avatar ? (
              <img 
                src={group.avatar} 
                alt={group.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Users className="h-8 w-8 text-white" />
            )}
          </div>
          
          {isAdmin && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <Camera className="h-3 w-3" />
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        
        {/* Group Stats in header */}
        <div className="flex-1">
          <div className="flex items-center gap-3 text-xs text-gray-600 mb-1">
            <Calendar className="h-3 w-3" />
            <span>Tạo ngày {new Date(group.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-600 mb-1">
            <Users className="h-3 w-3" />
            <span>{group.members?.length || 1} thành viên</span>
          </div>

          <div className="text-xs text-gray-500">
            Trưởng nhóm: {group.createdBy === currentUser?.id ? 'Bạn' : 'Trưởng nhóm'}
          </div>
        </div>
      </div>

      {/* Group Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Tên nhóm</label>
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') handleCancelName();
              }}
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancelName}
              className="p-2 text-gray-400 hover:bg-gray-50 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-gray-900 font-medium">{group.name}</p>
            {isAdmin && (
              <button
                onClick={() => setIsEditingName(true)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Group Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Mô tả</label>
        {isEditingDescription ? (
          <div className="space-y-2">
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Thêm mô tả cho nhóm..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
              rows="3"
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelDescription();
              }}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleCancelDescription}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveDescription}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Lưu
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className={`flex-1 text-sm ${group.description ? 'text-gray-600' : 'text-gray-400 italic'}`}>
              {group.description || (isAdmin ? 'Nhấn để thêm mô tả nhóm...' : 'Chưa có mô tả')}
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsEditingDescription(true)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>


    </div>
  );
};

export default GroupInfo;