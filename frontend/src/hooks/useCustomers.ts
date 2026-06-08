import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersService } from '@/services/customers'
import toast from 'react-hot-toast'

export const useCustomers = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => customersService.list(params).then((r) => r.data),
  })
}

export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersService.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export const useCreateCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: customersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Cliente creado exitosamente')
    },
    onError: () => toast.error('Error al crear el cliente'),
  })
}

export const useUpdateCustomer = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => customersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', id] })
      toast.success('Cliente actualizado exitosamente')
    },
    onError: () => toast.error('Error al actualizar el cliente'),
  })
}
