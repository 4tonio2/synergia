import React, { useState } from 'react';
import { ChevronLeft, ShoppingCart, Search, Plus, Minus, Package, ChevronRight, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

// Types pour les catégories
interface SubCategory {
  id: string;
  name: string;
  image: string;
}

interface Category {
  id: string;
  name: string;
  image: string;
  subcategories: SubCategory[];
}

// Données des catégories basées sur les images
const categories: Category[] = [
  {
    id: '1',
    name: 'LES DISPOSITIFS MÉDICAUX',
    image: '/images/1-LES DISPOSITIFS MEDICAUX.jpeg',
    subcategories: [
      { id: '1-1', name: 'MAINTIEN À DOMICILE', image: '/images/1-1-MAINTIEN A DOMICILE.jpeg' },
      { id: '1-2', name: 'INCONTINENCE ET UROLOGIE', image: '/images/1-2-INCONTINENCE ET UROLOGIE.jpeg' },
      { id: '1-3', name: 'PRÉVENTION DES ESCARRES', image: '/images/1-3-PREVENTION DES ESCARRES.jpeg' },
      { id: '1-4', name: 'PERFUSION À DOMICILE', image: '/images/1-4-PERFUSION A DOMICILE.jpeg' },
      { id: '1-5', name: 'SOINS DES PLAIES', image: '/images/1-5-SOINS DES PLAIS.jpeg' },
    ]
  },
  {
    id: '2',
    name: 'LES MÉDICAMENTS ET PRODUITS DE SANTÉ',
    image: '/images/2-LES MEDICAMENTS ET PRODUITS DE SANTE.jpeg',
    subcategories: [
      { id: '2-1', name: 'ANTISEPTIQUES', image: '/images/2-1-ANTISEPTIQUES.jpeg' },
      { id: '2-2', name: 'Substituts Nicotiniques', image: '/images/2-2-Substituts Nicotiniques.jpeg' },
      { id: '2-3', name: 'Vaccins', image: '/images/2-3-Vaccins.jpeg' },
    ]
  },
  {
    id: '3',
    name: 'LE RENOUVELLEMENT',
    image: '/images/3-LE RENOUVELLEMENT.jpeg',
    subcategories: [
      { id: '3-1', name: 'Contraceptifs oraux (Pilule)', image: '/images/3-1-Contraceptifs oraux (Pilule).jpeg' },
      { id: '3-2', name: 'Matériel de contention (Bas, chaussettes)', image: '/images/3-2-Matériel de contention (Bas, chaussettes).jpeg' },
      { id: '3-3', name: 'Diabète', image: '/images/3-3-Diabète.jpeg' },
    ]
  },
  {
    id: '4',
    name: 'Prescription examens biologiques et imagerie (IPA)',
    image: '/images/4-Prescription de certains examens biologiques et d\'imagerie ( IPA )..jpeg',
    subcategories: [
      { id: '4-1', name: 'Prescription examens biologiques et imagerie', image: '/images/4-1-Prescription de certains examens biologiques et d\'imagerie..jpeg' },
      { id: '4-2', name: 'Renouvellement traitements pathologies chroniques', image: '/images/4-2-Renouvellement et adaptation des traitements médicaux pathologies chroniques stabilisées (diabète, insuffisance cardiaque, etc.)..jpeg' },
    ]
  },
  {
    id: '5',
    name: 'Renouvellement pathologies chroniques (IPA)',
    image: '/images/5-Renouvellement et adaptation pathologies chroniques stabilisées (diabète, insuffisance cardiaque, etc.) ( infirmier IPA.jpeg',
    subcategories: []
  },
  {
    id: '6',
    name: 'Prescription médicaments non soumis à prescription obligatoire',
    image: '/images/6-6. Prescription de certains médicaments non soumis à prescription médicale obligatoire..jpeg',
    subcategories: []
  },
];

// Composant pour afficher une catégorie ou sous-catégorie
interface CategoryCardProps {
  name: string;
  image: string;
  onClick: () => void;
  hasSubcategories?: boolean;
}

const CategoryCard = ({ name, image, onClick, hasSubcategories = false }: CategoryCardProps) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition duration-150 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="relative h-16 bg-white flex items-center justify-center p-2">
        {!imageError ? (
          <img 
            src={image} 
            alt={name}
            className="h-12 w-12 object-contain rounded-lg"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="h-12 w-12 flex items-center justify-center">
            <Package size={24} className="text-blue-400" />
          </div>
        )}
        {hasSubcategories && (
          <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5">
            <ChevronRight size={12} />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="font-semibold text-gray-800 text-xs text-center line-clamp-2">{name}</p>
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
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
    } else {
      setLocation('/dashboard');
    }
  };

  const handleCategoryClick = (category: Category) => {
    if (category.subcategories.length > 0) {
      setSelectedCategory(category);
    } else {
      // Catégorie sans sous-catégories - action directe
      toast({
        title: category.name,
        description: "Cette catégorie n'a pas de sous-catégories",
      });
    }
  };

  const handleSubcategoryClick = (subcategory: SubCategory) => {
    toast({
      title: subcategory.name,
      description: "Produits de cette sous-catégorie à venir",
    });
  };

  const handleAddToCart = (name: string, quantity: number) => {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.name === name);
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += quantity;
        toast({
          title: "Panier mis à jour",
          description: `${name} (x${quantity}) ajouté`,
        });
        return newCart;
      } else {
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
    
    setTimeout(() => {
      setCartItems([]);
    }, 1500);
  };
  
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Filtrer les catégories/sous-catégories selon la recherche
  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.subcategories.some(sub => sub.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSubcategories = selectedCategory?.subcategories.filter(sub =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
          <h1 className="text-xl font-bold text-gray-800">
            {selectedCategory ? selectedCategory.name : 'Catalogue'}
          </h1>
          <p className="text-xs text-gray-500">
            {selectedCategory 
              ? `${selectedCategory.subcategories.length} sous-catégories`
              : 'Sélectionnez une catégorie'
            }
          </p>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une catégorie..."
              className="w-full focus:outline-none text-gray-700"
            />
          </div>
        </div>

        {/* Breadcrumb si dans une catégorie */}
        {selectedCategory && (
          <div className="mb-4 flex items-center text-sm text-gray-500">
            <button 
              onClick={() => setSelectedCategory(null)}
              className="hover:text-blue-600 transition"
            >
              Catalogue
            </button>
            <ChevronRight size={16} className="mx-2" />
            <span className="text-gray-800 font-medium truncate">{selectedCategory.name}</span>
          </div>
        )}

        {/* Grille des catégories ou sous-catégories */}
        <div className="grid grid-cols-2 gap-4">
          {!selectedCategory ? (
            // Afficher les catégories principales
            filteredCategories.map((category) => (
              <CategoryCard
                key={category.id}
                name={category.name}
                image={category.image}
                onClick={() => handleCategoryClick(category)}
                hasSubcategories={category.subcategories.length > 0}
              />
            ))
          ) : (
            // Afficher les sous-catégories
            filteredSubcategories.map((subcategory) => (
              <CategoryCard
                key={subcategory.id}
                name={subcategory.name}
                image={subcategory.image}
                onClick={() => handleSubcategoryClick(subcategory)}
              />
            ))
          )}
        </div>

        {/* Message si aucun résultat */}
        {((selectedCategory && filteredSubcategories.length === 0) || 
          (!selectedCategory && filteredCategories.length === 0)) && (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p>Aucune catégorie trouvée</p>
          </div>
        )}
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
