import React, { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import axios from 'axios';

const PaymentForm = ({ item, onSuccess, onError }) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  
  const { user } = useSelector(state => state.auth);
  const { currency } = useSelector(state => state.settings);

  // 格式化价格显示
  const formatPrice = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // 创建支付意向
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await axios.post('/api/create-payment-intent', {
          userId: user.id,
          amount: item.price,
          currency: currency || item.currency,
          itemId: item.id
        });
        
        setClientSecret(response.data.clientSecret);
      } catch (err) {
        setError(t('payment.error.creating_intent') + (err.response?.data?.error || ''));
        if (onError) onError(err);
      }
    };

    if (item && user) {
      createPaymentIntent();
    }
  }, [item, user, currency, t]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
      // 确认支付
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user.name,
            email: user.email,
          },
        }
      });

      if (error) {
        setError(error.message);
        if (onError) onError(error);
      } else if (paymentIntent.status === 'succeeded') {
        // 支付成功
        if (onSuccess) onSuccess(paymentIntent);
      }
    } catch (err) {
      setError(t('payment.error.processing') + (err.message || ''));
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="form-group mb-4">
        <h3 className="mb-2">{t('payment.payment_details')}</h3>
        <div className="card-element-container p-3 border rounded">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>
      
      <div className="payment-summary mb-4 p-3 bg-gray-50 rounded">
        <h4>{t('payment.order_summary')}</h4>
        <div className="d-flex justify-content-between mt-2">
          <span>{item.name}</span>
          <span>{formatPrice(item.price, currency || item.currency)}</span>
        </div>
        <div className="d-flex justify-content-between mt-2 font-bold">
          <span>{t('payment.total')}</span>
          <span>{formatPrice(item.price, currency || item.currency)}</span>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || loading || !clientSecret}
        className="btn btn-primary w-100 py-2"
      >
        {loading ? t('payment.processing') : t('payment.pay_now', { amount: formatPrice(item.price, currency || item.currency) })}
      </button>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        {t('payment.secure_notice')}
        <div className="mt-2">
          <img src="/images/payment-methods.png" alt="Supported payment methods" className="mx-auto h-8" />
        </div>
      </div>
    </form>
  );
};

export default PaymentForm;
