import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../constants/app_colors.dart';
import 'shimmer_loading.dart';

/// Renders the rich-text HTML stored on the `general/config` document (privacy
/// policy, terms) inside a WebView, with a shimmer until the first paint.
///
/// WHY a WebView and not a Dart HTML renderer: the content is authored in React
/// Quill on the admin side and can contain arbitrary nested markup, lists and
/// links. A partial renderer would silently drop formatting from a legal
/// document, which is the one place that must render exactly as written.
///
/// The HTML is wrapped in a document that pins the app's typography and blocks
/// horizontal overflow, so pasted content cannot force the page sideways.
class HtmlContentView extends StatefulWidget {
  const HtmlContentView({
    super.key,
    required this.html,
    this.backgroundColor,
  });

  final String html;
  final Color? backgroundColor;

  @override
  State<HtmlContentView> createState() => _HtmlContentViewState();
}

class _HtmlContentViewState extends State<HtmlContentView> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.disabled)
      ..setBackgroundColor(widget.backgroundColor ?? AppColors.background)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          // Static content — nothing in a policy document should navigate the
          // WebView itself.
          onNavigationRequest: (_) => NavigationDecision.prevent,
        ),
      )
      ..loadHtmlString(_wrap(widget.html));
  }

  @override
  void didUpdateWidget(covariant HtmlContentView oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The general doc arrives asynchronously, so the first build is often an
    // empty string; reload when the real content lands.
    if (oldWidget.html != widget.html) {
      setState(() => _loading = true);
      _controller.loadHtmlString(_wrap(widget.html));
    }
  }

  String _wrap(String body) => '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html,body { margin:0; padding:0 4px; background:transparent;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    font-size:14px; line-height:1.6; color:#1F1F1F;
    overflow-x:hidden; word-wrap:break-word; }
  h1,h2,h3 { font-weight:800; line-height:1.3; margin:18px 0 8px; }
  h1{font-size:20px} h2{font-size:17px} h3{font-size:15px}
  p { margin:0 0 12px; }
  ul,ol { padding-left:20px; margin:0 0 12px; }
  li { margin-bottom:6px; }
  a { color:#0F7A5A; }
  img,table { max-width:100%; height:auto; }
  table { display:block; overflow-x:auto; }
</style>
</head>
<body>$body</body>
</html>''';

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_loading)
          Positioned.fill(
            child: ColoredBox(
              color: widget.backgroundColor ?? AppColors.background,
              child: const ShimmerLoading(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ShimmerBox(width: 180, height: 18),
                      SizedBox(height: 16),
                      ShimmerBox(width: double.infinity, height: 12),
                      SizedBox(height: 10),
                      ShimmerBox(width: double.infinity, height: 12),
                      SizedBox(height: 10),
                      ShimmerBox(width: 220, height: 12),
                      SizedBox(height: 24),
                      ShimmerBox(width: 150, height: 18),
                      SizedBox(height: 16),
                      ShimmerBox(width: double.infinity, height: 12),
                      SizedBox(height: 10),
                      ShimmerBox(width: 260, height: 12),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
