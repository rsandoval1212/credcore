import { useQuery, useMutation } from '@tanstack/react-query'
import { loansService } from '@/services/loans'
import toast from 'react-hot-toast'

export const useLoans = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['loans', params],
    queryFn: () => loansService.list(params).then((r) => r.data),
  })
}

export const useLoan = (id: string) => {
  return useQuery({
    queryKey: ['loans', id],
    queryFn: () => loansService.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export const useLoanSchedule = (id: string) => {
  return useQuery({
    queryKey: ['loans', id, 'schedule'],
    queryFn: () => loansService.getSchedule(id).then((r) => r.data),
    enabled: !!id,
  })
}

export const useLoanSimulator = () => {
  return useMutation({
    mutationFn: loansService.simulate,
    onError: () => toast.error('Error en la simulación'),
  })
}
