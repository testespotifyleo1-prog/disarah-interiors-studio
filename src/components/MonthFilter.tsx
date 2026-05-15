import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthFilterProps {
  currentMonth: Date;
  onChange: (date: Date) => void;
}

export function MonthFilter({ currentMonth, onChange }: MonthFilterProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card px-1 py-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(subMonths(currentMonth, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[120px] text-center capitalize">
        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(addMonths(currentMonth, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function getMonthRange(date: Date) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}
