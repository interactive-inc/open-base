export declare const calendarDateBrand: unique symbol

export type CalendarDate = string & { readonly [calendarDateBrand]: true }
