/**
 * Pass Holder Registration — English translations
 * Namespace: passHolder
 *
 * Language settings for the public "Get Pass" page; the target audience is
 * Pass Holders (wallet card end-users), NOT SAOME platform members.
 *
 * @module i18n/locales/passHolder.en
 */

export default {
  title: 'Get Your Exclusive Pass',
  subtitle: 'Fill in the form below to join {{issuerName}}',
  fields: {
    name: {
      label: 'Name',
      placeholder: 'Enter your name',
    },
    phone: {
      countryCodeLabel: 'Country Code',
      numberLabel: 'Phone Number',
      numberPlaceholder: '0912345678',
    },
    birthday: {
      label: 'Birthday',
      hint: 'Must be at least 13 years old',
    },
    email: {
      label: 'Email',
      placeholder: 'you@example.com',
    },
  },
  submit: 'Get Pass',
  submitting: 'Submitting...',
  success: {
    title: 'Thanks for registering!',
    description: 'The Pass download feature is coming soon. Please check back later.',
    backToTemplate: 'Back to {{templateName}}',
  },
  errors: {
    templateNotFound: 'This template cannot be found or has been removed.',
    networkError: 'Network error. Please try again later.',
  },
  validation: {
    nameRequired: 'Please enter your name',
    nameTooShort: 'Name must be at least 2 characters',
    phoneInvalid: 'Invalid phone number format',
    birthdayInvalid: 'Invalid birthday format',
    emailInvalid: 'Invalid email format',
    ageTooYoung: 'Must be at least 13 years old',
  },
};