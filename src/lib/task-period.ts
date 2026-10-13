import type {Locale} from "./i18n";
import type {DateRangePreset} from "@/components/ui/date-range-picker";

const copy = {
 ru:{label:"Период дедлайнов",placeholder:"Выберите даты",reset:"Все даты",presets:["Сегодня","Завтра","Ближайшие 7 дней","Последние 7 дней","Последние 30 дней","Этот месяц","Прошлый месяц","Этот квартал","С начала года"]},
 kk:{label:"Мерзімдер кезеңі",placeholder:"Күндерді таңдаңыз",reset:"Барлық күндер",presets:["Бүгін","Ертең","Алдағы 7 күн","Соңғы 7 күн","Соңғы 30 күн","Осы ай","Өткен ай","Осы тоқсан","Жыл басынан"]},
 en:{label:"Deadline period",placeholder:"Choose dates",reset:"All dates",presets:["Today","Tomorrow","Next 7 days","Last 7 days","Last 30 days","This month","Last month","This quarter","Year to date"]},
};
export const taskPeriodCopy=(locale:Locale)=>copy[locale];
export function taskPeriodPresets(locale:Locale):DateRangePreset[]{
 const day=(today:Date,offset:number)=>new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset);
 const month=(today:Date,offset:number,date:number)=>new Date(today.getFullYear(),today.getMonth()+offset,date);
 const ranges:DateRangePreset["range"][]=[
  t=>({start:day(t,0),end:day(t,0)}),t=>({start:day(t,1),end:day(t,1)}),
  t=>({start:day(t,0),end:day(t,6)}),t=>({start:day(t,-6),end:day(t,0)}),t=>({start:day(t,-29),end:day(t,0)}),
  t=>({start:month(t,0,1),end:month(t,1,0)}),t=>({start:month(t,-1,1),end:month(t,0,0)}),
  t=>({start:new Date(t.getFullYear(),Math.floor(t.getMonth()/3)*3,1),end:day(t,0)}),
  t=>({start:new Date(t.getFullYear(),0,1),end:day(t,0)}),
 ];
 return ranges.map((range,index)=>({label:copy[locale].presets[index],range}));
}
