import React, { useState } from 'react';
import { ChevronLeft, ShoppingCart, Search, Plus, Minus, Package, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface ShopItemProps {
  icon: string;
  name: string;
  initialQuantity: number;
  onAddToCart: (name: string, quantity: number) => void;
}

const ShopItem = ({ icon, name, initialQuantity, onAddToCart }: ShopItemProps) => {
  const [quantity, setQuantity] = useState(initialQuantity);

  const handleUpdateQuantity = (delta: number) => {
    setQuantity(prev => Math.max(0, prev + delta));
  };

  const handleAdd = () => {
    if (quantity > 0) {
      onAddToCart(name, quantity);
      setQuantity(0); // Réinitialiser après ajout
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 flex flex-col justify-between h-56 transition duration-150 hover:shadow-lg">
      <div className="text-center mb-3 flex-1 flex flex-col items-center justify-center">
        <div className="text-3xl mb-2">{icon}</div>
        <p className="font-semibold text-gray-800 text-center text-sm">{name}</p>
      </div>

      <div className="flex items-center justify-between mt-3 border-t pt-3">
        {/* Compteur de quantité */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleUpdateQuantity(-1)}
            className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
          >
            <Minus size={16} />
          </button>
          <span className="font-bold text-lg w-6 text-center">{quantity}</span>
          <button
            onClick={() => handleUpdateQuantity(1)}
            className="p-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            <Plus size={16} />
          </button>
        </div>
        
        {/* Bouton Ajouter */}
        <button
          onClick={handleAdd}
          disabled={quantity === 0}
          className={`py-1.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
            quantity > 0 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
};

interface CartItem {
  name: string;
  quantity: number;
}

export default function E19_ShopView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const shopCategories = [
    { icon: '🩹', name: 'Pansements (tous formats)', initialQuantity: 0 },
    { icon: '🩲', name: 'Changes complets / couches', initialQuantity: 0 },
    { icon: '🧴', name: 'Crèmes pour plaies / peaux fragiles', initialQuantity: 0 },
    { icon: '🧤', name: 'Gants nitrile', initialQuantity: 0 },
    { icon: '🧻', name: 'Alèses absorbantes', initialQuantity: 0 },
    { icon: '🩺', name: 'Compresses stériles', initialQuantity: 0 },
    { icon: '💉', name: 'Matériel injection (aiguilles, seringues)', initialQuantity: 0 },
    { icon: '🧪', name: 'Tests rapides (Bandelettes)', initialQuantity: 0 },
  ];

  const handleBack = () => {
    setLocation('/dashboard');
  };

  const handleAddToCart = (name: string, quantity: number) => {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.name === name);
      if (existingIndex > -1) {
        // Mettre à jour la quantité
        const newCart = [...prev];
        newCart[existingIndex].quantity += quantity;
        toast({
          title: "Panier mis à jour",
          description: `${name} (x${quantity}) ajouté`,
        });
        return newCart;
      } else {
        // Ajouter un nouvel article
        toast({
          title: "Ajouté au panier",
          description: `${name} (x${quantity})`,
        });
        return [...prev, { name, quantity }];
      }
    });
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des articles avant de commander",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Commande vers Odoo e-Shop:', cartItems);
    toast({
      title: "Commande passée",
      description: `${totalItems} articles commandés via Odoo e-Shop`,
    });
    
    // Réinitialiser le panier après commande
    setTimeout(() => {
      setCartItems([]);
    }, 1500);
  };
  
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <button 
          onClick={handleBack} 
          className="text-gray-600 hover:text-gray-800 mr-4 transition"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Vue Shop</h1>
          <p className="text-xs text-gray-500">Commandes de fournitures médicales</p>
        </div>
        <div className="relative">
          <ShoppingCart size={24} className="text-gray-600" />
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              {totalItems}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto pb-24">
        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="flex items-center bg-white rounded-xl shadow-sm p-3 border border-gray-200">
            <Search size={20} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Rechercher pansement, gants, alèses..."
              className="w-full focus:outline-none text-gray-700"
            />
          </div>
        </div>

        {/* Info Odoo */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800 font-medium">
            🔗 Connecté à Odoo e-Shop + Inventory + Purchase
          </p>
        </div>

        {/* Grille des produits */}
        <div className="grid grid-cols-2 gap-4">
          {shopCategories.map((item, index) => (
            <ShopItem 
              key={index} 
              icon={item.icon} 
              name={item.name} 
              initialQuantity={item.initialQuantity} 
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      </div>

      {/* CTA Panier / Commander - Fixed at bottom */}
      <div className="p-4 bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 max-w-md mx-auto shadow-lg">
        <Button
          onClick={handleCheckout}
          disabled={totalItems === 0}
          className={`w-full flex items-center justify-center space-x-2 py-6 rounded-xl font-semibold transition duration-200 shadow-lg ${
            totalItems > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <ShoppingCart size={20} />
          <span>Passer la commande ({totalItems} article{totalItems > 1 ? 's' : ''})</span>
        </Button>
      </div>
    </div>
  );
}
