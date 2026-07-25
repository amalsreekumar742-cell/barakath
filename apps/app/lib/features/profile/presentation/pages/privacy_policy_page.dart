import 'package:flutter/material.dart';

import '../widgets/legal_document_view.dart';

/// Privacy policy — the admin's rich text from `general/config.privacyPolicy`,
/// rendered by the shared [LegalDocumentPage].
class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

  @override
  Widget build(BuildContext context) => const LegalDocumentPage(
        title: 'Privacy policy',
        document: LegalDocument.privacyPolicy,
      );
}
