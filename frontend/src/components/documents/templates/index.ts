// Export all invoice templates
export { ClassicTemplate } from './invoice-classic';
export { ModernTemplate } from './invoice-modern';
export { MinimalTemplate } from './invoice-minimal';
export { BoldTemplate } from './invoice-bold';
export { ElegantTemplate } from './invoice-elegant';

// Template registry for dynamic selection
export const invoiceTemplates = {
    classic: {
        name: 'Template 1',
        description: 'Traditional business invoice with clear sections',
        component: 'ClassicTemplate',
    },
    modern: {
        name: 'Template 2',
        description: 'Contemporary design with gradient accents',
        component: 'ModernTemplate',
    },
    minimal: {
        name: 'Template 3',
        description: 'Clean, ultra-simple design with whitespace',
        component: 'MinimalTemplate',
    },
    bold: {
        name: 'Template 4',
        description: 'High-contrast design with strong typography',
        component: 'BoldTemplate',
    },
    elegant: {
        name: 'Template 5',
        description: 'Sophisticated design with serif typography',
        component: 'ElegantTemplate',
    },
} as const;

export type TemplateName = keyof typeof invoiceTemplates;
