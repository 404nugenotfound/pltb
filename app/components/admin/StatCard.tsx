'use client';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  isFirst?: boolean;
  isSecond?: boolean;
}

export const StatCard = ({ title, value, icon, subtitle, isFirst = false, isSecond = false }: StatCardProps) => {
  const getGradient = () => {
    if (isFirst) return 'from-[#00a991] to-[#007f6d]';
    if (isSecond) return 'from-[#008774] to-[#006557]';
    return 'from-[#009883] to-[#004c41]';
  };
  
  return (
    <div className={`relative overflow-hidden rounded-xl bg-linear-to-br ${getGradient()} p-6 pb-6 text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs font-medium tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
            {subtitle && <p className="text-white/70 text-[10px] mt-0.5">{subtitle}</p>}
          </div>
          <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};