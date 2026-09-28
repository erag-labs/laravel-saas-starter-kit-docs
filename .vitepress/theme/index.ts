import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import CTASection from './components/CTASection.vue';
import AppOutOfTheBox from './components/AppOutOfTheBox.vue';
import CustomizeEverything from './components/CustomizeEverything.vue';
import DeveloperExperience from './components/DeveloperExperience.vue';
import LayoutPlayground from './components/LayoutPlayground.vue';
import PaymentGateway from './components/PaymentGateway.vue';
import PrivateRepoNotice from './components/PrivateRepoNotice.vue';
import TestimonialsSection from './components/TestimonialsSection.vue';
import FaqList from './components/FaqList.vue';
import FeatureGrid from './components/FeatureGrid.vue';
import FeatureSection from './components/FeatureSection.vue';
import FrameworkCards from './components/FrameworkCards.vue';
import HeroSection from './components/HeroSection.vue';
import HowToPay from './components/HowToPay.vue';
import KitDetail from './components/KitDetail.vue';
import PricingDetail from './components/PricingDetail.vue';
import PricingSection from './components/PricingSection.vue';
import SiteFooter from './components/SiteFooter.vue';
import TechStack from './components/TechStack.vue';
import ThreeFrameworksOneBackend from './components/ThreeFrameworksOneBackend.vue';
import WeeklyUpdates from './components/WeeklyUpdates.vue';
import WhySection from './components/WhySection.vue';
import Layout from './Layout.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('HeroSection', HeroSection);
    app.component('TechStack', TechStack);
    app.component('FrameworkCards', FrameworkCards);
    app.component('WhySection', WhySection);
    app.component('FeatureSection', FeatureSection);
    app.component('FeatureGrid', FeatureGrid);
    app.component('ThreeFrameworksOneBackend', ThreeFrameworksOneBackend);
    app.component('AppOutOfTheBox', AppOutOfTheBox);
    app.component('CustomizeEverything', CustomizeEverything);
    app.component('DeveloperExperience', DeveloperExperience);
    app.component('LayoutPlayground', LayoutPlayground);
    app.component('PaymentGateway', PaymentGateway);
    app.component('PrivateRepoNotice', PrivateRepoNotice);
    app.component('TestimonialsSection', TestimonialsSection);
    app.component('WeeklyUpdates', WeeklyUpdates);
    app.component('PricingSection', PricingSection);
    app.component('PricingDetail', PricingDetail);
    app.component('KitDetail', KitDetail);
    app.component('HowToPay', HowToPay);
    app.component('FaqList', FaqList);
    app.component('CTASection', CTASection);
    app.component('SiteFooter', SiteFooter);
  },
} satisfies Theme;
