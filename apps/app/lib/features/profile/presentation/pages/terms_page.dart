import 'package:flutter/material.dart';

import '../widgets/legal_document_view.dart';

/// Terms & conditions — the admin's rich text from
/// `general/config.termsAndConditions`, rendered by [LegalDocumentPage].
class TermsPage extends StatelessWidget {
  const TermsPage({super.key});

  @override
  Widget build(BuildContext context) => const LegalDocumentPage(
        title: 'Terms & conditions',
        document: LegalDocument.termsAndConditions,
      );
}
