import { useState, useEffect } from 'react';
import { X, Download, RotateCcw, Loader2, Clock, FileText, AlertCircle } from 'lucide-react';
import { getFileVersions, restoreFileVersion } from '../../services/fileVersionService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * VersionHistoryModal - Modal hiển thị lịch sử phiên bản file
 * Tất cả thành viên đều xem được, nhưng chỉ owner mới restore được
 */
export default function VersionHistoryModal({ file, onClose, onRestore }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [canUpdate, setCanUpdate] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVersions();
  }, [file.id]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getFileVersions(file.id);
      
      setVersions(response.data.versions || []);
      setCurrentVersion(response.data.currentVersion || 1);
      setCanUpdate(response.data.canUpdate || false);
      
    } catch (err) {
      console.error('Error loading versions:', err);
      setError(err.message || 'Lỗi khi tải lịch sử phiên bản');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionNumber) => {
    if (!confirm(`Khôi phục phiên bản ${versionNumber}?\n\nPhiên bản hiện tại sẽ được lưu vào lịch sử.`)) {
      return;
    }

    try {
      setRestoring(versionNumber);
      setError(null);

      const response = await restoreFileVersion(file.id, versionNumber);
      
      console.log('✅ Version restored:', response);

      // Callback
      if (onRestore) {
        onRestore(response.data);
      }

      // Reload versions
      await loadVersions();

    } catch (err) {
      console.error('Error restoring version:', err);
      setError(err.message || 'Lỗi khi khôi phục phiên bản');
    } finally {
      setRestoring(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const truncateFileName = (fileName, maxLength = 40) => {
    if (fileName.length <= maxLength) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension, just truncate
      return fileName.substring(0, maxLength - 3) + '...';
    }
    
    const extension = fileName.substring(lastDotIndex);
    const nameWithoutExt = fileName.substring(0, lastDotIndex);
    const availableLength = maxLength - extension.length - 4; // 4 for '... '
    
    if (availableLength < 10) {
      // Extension too long, just show start + extension
      return fileName.substring(0, 10) + '... ' + extension;
    }
    
    return nameWithoutExt.substring(0, availableLength) + '... ' + extension;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {canUpdate ? 'Quản lý phiên bản' : 'Lịch sử phiên bản'}
            </h3>
            <p className="text-sm text-gray-500 mt-1" title={file.name}>
              {truncateFileName(file.name, 50)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Không có lịch sử phiên bản</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                  <div
                  key={version.versionNumber}
                  className={`
                    border rounded-lg p-4 transition-all
                    ${version.isCurrent 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Version Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`
                          w-3 h-3 rounded-full
                          ${version.isCurrent ? 'bg-emerald-600' : 'bg-gray-300'}
                        `} />
                        <h4 className="font-semibold text-gray-900">
                          Phiên bản {version.versionNumber}
                          {version.isCurrent && (
                            <span className="ml-2 text-xs font-normal text-emerald-600">(Hiện tại)</span>
                          )}
                          {version.versionNumber === 1 && (
                            <span className="ml-2 text-xs font-normal text-gray-500">(Gốc)</span>
                          )}
                        </h4>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium text-gray-900 block" title={version.fileName}>
                            {truncateFileName(version.fileName, 45)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(version.uploadedAt)}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(version.size)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {/* Download */}
                      <a
                        href={version.storagePath}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Tải xuống
                      </a>

                      {/* Restore (chỉ hiện cho owner và không phải version hiện tại) */}
                      {!version.isCurrent && version.canRestore && (
                        <button
                          onClick={() => handleRestore(version.versionNumber)}
                          disabled={restoring !== null}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {restoring === version.versionNumber ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Đang khôi phục...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4" />
                              Khôi phục
                            </>
                          )}
                        </button>
                      )}

                      {/* Disabled Restore (cho non-owner) */}
                      {!version.isCurrent && !version.canRestore && (
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded cursor-not-allowed"
                          title="Chỉ người gửi file mới có thể khôi phục"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Khôi phục
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Note */}
          {!loading && versions.length > 0 && (
            <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-600">
                Chỉ giữ tối đa 5 phiên bản gần nhất. 
                {!canUpdate && ' Chỉ người gửi file mới có thể cập nhật hoặc khôi phục phiên bản.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
