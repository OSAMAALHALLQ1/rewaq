import React from 'react';
import { 
  ChefHat, 
  CupSoda, 
  Wind, 
  Flame, 
  Coffee, 
  Pizza, 
  IceCream, 
  UtensilsCrossed, 
  Salad, 
  Apple, 
  GlassWater 
} from 'lucide-react';

export const ICON_MAP = {
  // Departments / Categories
  'chef-hat': ChefHat,
  'kitchen': ChefHat,
  '🍳': ChefHat,
  'cup-soda': CupSoda,
  'bar': CupSoda,
  '🍺': CupSoda,
  '🥤': CupSoda,
  'glass-water': GlassWater,
  'wind': Wind,
  'shisha': Wind,
  '💨': Wind,
  'flame': Flame,
  'grill': Flame,
  '🔥': Flame,
  'coffee': Coffee,
  '☕': Coffee,
  'tea': Coffee,
  '🍵': Coffee,
  'pizza': Pizza,
  '🍕': Pizza,
  'ice-cream': IceCream,
  'cake': IceCream,
  '🍰': IceCream,
  '🍦': IceCream,
  'burger': UtensilsCrossed,
  '🍔': UtensilsCrossed,
  'wrap': UtensilsCrossed,
  '🌯': UtensilsCrossed,
  'chicken': UtensilsCrossed,
  '🍗': UtensilsCrossed,
  'salad': Salad,
  '🥗': Salad,
  'orange': Apple,
  'lemon': Apple,
  'apple': Apple,
  'strawberry': Apple,
  '🍊': Apple,
  '🍋': Apple,
  '🍎': Apple,
  '🍓': Apple,
  'water': GlassWater,
  '💧': GlassWater,
  'utensils': UtensilsCrossed,
  '🍽': UtensilsCrossed,
  '🍽️': UtensilsCrossed
};

export const DEPARTMENT_ICONS = [
  { id: 'chef-hat', label: 'مطبخ / طعام', icon: ChefHat },
  { id: 'cup-soda', label: 'بار / مشروبات', icon: CupSoda },
  { id: 'wind', label: 'شيشة / أرجيلة', icon: Wind },
  { id: 'flame', label: 'مشاوي / نار', icon: Flame },
  { id: 'pizza', label: 'معجنات / بيتزا', icon: Pizza },
  { id: 'coffee', label: 'مقهى / قهوة', icon: Coffee },
  { id: 'utensils', label: 'عام / صالة', icon: UtensilsCrossed }
];

export const renderItemImage = (image, name, isCard = false, placeholderType = 'money') => {
  const isUrl = image && (image.startsWith('http') || image.startsWith('data:image/'));
  
  if (isUrl) {
    return (
      <img 
        src={image} 
        alt={name} 
        loading="lazy"
        decoding="async"
        width={isCard ? 400 : 40}
        height={isCard ? 300 : 40}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.onerror = null;
        }}
        style={isCard ? { 
          width: '100%', 
          height: '90px', 
          objectFit: 'cover', 
          borderRadius: '6px', 
          marginBottom: '6px', 
          display: 'block' 
        } : { 
          width: '40px', 
          height: '40px', 
          objectFit: 'cover', 
          borderRadius: '6px', 
          display: 'block',
          flexShrink: 0
        }} 
      />
    );
  }

  const TargetIcon = ICON_MAP[image];
  if (TargetIcon) {
    const iconSize = isCard ? 32 : 20;
    return (
      <div 
        style={isCard ? {
          width: '100%',
          height: '90px',
          borderRadius: '6px',
          marginBottom: '6px',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.01) 100%)',
          border: '1px dashed rgba(220, 38, 38, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)'
        } : {
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.01) 100%)',
          border: '1px dashed rgba(220, 38, 38, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)',
          flexShrink: 0
        }}
      >
        <TargetIcon size={iconSize} />
      </div>
    );
  }

  if (image && image.length <= 4) {
    return (
      <div 
        style={isCard ? {
          width: '100%',
          height: '90px',
          borderRadius: '6px',
          marginBottom: '6px',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.01) 100%)',
          border: '1px dashed rgba(220, 38, 38, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem'
        } : {
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.01) 100%)',
          border: '1px dashed rgba(220, 38, 38, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          flexShrink: 0
        }}
      >
        {image}
      </div>
    );
  }

  return (
    <div 
      style={isCard ? {
        width: '100%',
        height: '90px',
        borderRadius: '6px',
        marginBottom: '6px',
        background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.01) 100%)',
        border: '1px dashed rgba(220, 38, 38, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-primary)'
      } : {
        width: '40px',
        height: '40px',
        borderRadius: '6px',
        background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(220,38,38,0.01) 100%)',
        border: '1px dashed rgba(220, 38, 38, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-primary)',
        flexShrink: 0
      }}
    >
      {placeholderType === 'dept' ? (
        <ChefHat size={isCard ? 24 : 16} />
      ) : (
        <UtensilsCrossed size={isCard ? 24 : 16} />
      )}
    </div>
  );
};
