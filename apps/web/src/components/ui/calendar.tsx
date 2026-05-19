import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      formatters={{
        formatCaption: (month) => `${month.getFullYear()}年${month.getMonth() + 1}月`,
        formatWeekdayName: (day) => weekdayLabels[day.getDay()],
        ...props.formatters
      }}
      labels={{
        labelNext: () => "下个月",
        labelPrevious: () => "上个月",
        ...props.labels
      }}
      classNames={{
        root: "rdp relative",
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-3",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "px-10 text-sm font-semibold text-radar-ink",
        nav: "pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "pointer-events-auto relative z-20 h-7 w-7 rounded-full text-radar-ink-muted hover:text-radar-ink"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "pointer-events-auto relative z-20 h-7 w-7 rounded-full text-radar-ink-muted hover:text-radar-ink"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-[11px] font-medium text-radar-ink-muted",
        week: "flex w-full",
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm",
          props.mode === "range" &&
            "[&.rdp-range_middle]:bg-radar-surface-soft [&.rdp-range_start]:bg-radar-surface-soft [&.rdp-range_end]:bg-radar-surface-soft"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-none p-0 text-sm font-normal text-radar-ink hover:bg-radar-surface-soft aria-selected:opacity-100"
        ),
        range_start:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        range_end:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        range_middle: "[&>button]:bg-transparent [&>button]:text-radar-ink",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "border border-radar-line-strong text-radar-ink",
        outside: "text-radar-ink-muted opacity-40",
        disabled: "text-radar-ink-muted opacity-40",
        hidden: "invisible",
        ...classNames
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
