import { z } from 'zod'

export const bookingRequestSchema = z
  .object({
    guestName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    guestEmail: z.string().email('Please enter a valid email address').max(120),
    guestPhone: z.string().max(20).optional().or(z.literal('')),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    numGuests: z.coerce
      .number()
      .int()
      .min(1, 'At least 1 guest is required')
      .max(10, 'Maximum 10 guests allowed'),
    specialRequests: z.string().max(2000).optional().or(z.literal('')),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>

// Additional business rule validation
export const validateBookingDates = (data: { startDate: Date; endDate: Date }) => {
  const errors: string[] = []

  if (data.endDate <= data.startDate) {
    errors.push('End date must be after start date')
  }

  const nights = Math.ceil(
    (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (nights < 2) {
    errors.push('Minimum stay is 2 nights')
  }

  if (nights > 30) {
    errors.push('Maximum stay is 30 nights')
  }

  return errors
}
