'use client';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
  mode?: 'deactivate' | 'activate';
}

export const DeleteConfirmModal = ({ isOpen, username, onConfirm, onCancel, mode = 'deactivate' }: DeleteConfirmModalProps) => {
  if (!isOpen) return null;

  const isActivate = mode === 'activate';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999 animate-fadeIn">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl transform animate-scaleIn">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isActivate ? 'bg-green-100' : 'bg-red-100'}`}>
          {isActivate ? (
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-bold text-gray-800 text-center mb-2 ">
          {isActivate ? 'Konfirmasi Aktifkan' : 'Konfirmasi Nonaktifkan'}
        </h3>
        <p className="text-gray-500 text-sm text-center mb-6">
          {isActivate ? (
            <>Aktifkan kembali akun <span className="font-semibold text-gray-700">{username}</span>?<br />Pengguna akan bisa login dan mengakses sistem kembali.</>
          ) : (
            <>Apakah Anda yakin ingin menonaktifkan akun{' '}
            <span className="font-semibold text-gray-700">{username}</span>?<br />
            Pengguna tidak akan bisa login dan mengakses sistem.</>
          )}
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all"
          >
            Batal
          </button>
          <button 
            onClick={onConfirm} 
            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-medium transition-all ${
              isActivate 
                ? 'bg-linear-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:shadow-green-500/25' 
                : 'bg-linear-to-r from-red-500 to-rose-500 hover:shadow-lg hover:shadow-red-500/25'
            }`}
          >
            {isActivate ? 'Aktifkan' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
};