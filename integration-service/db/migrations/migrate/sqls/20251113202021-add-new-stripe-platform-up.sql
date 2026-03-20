/* Replace with your SQL commands */
insert into integrations.core_categories (id, code, label) values(10, 'payment_processors', 'Payment Processors');
insert into integrations.core_integrations_platforms (id, code, label, category_id) values(41, 'stripe', 'Stripe', 10);