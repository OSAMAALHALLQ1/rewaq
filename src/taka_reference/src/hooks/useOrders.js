import { useContext } from 'react';
import { OrderContext } from '../context/OrderContext';

export function useOrders() {
  return useContext(OrderContext);
}
