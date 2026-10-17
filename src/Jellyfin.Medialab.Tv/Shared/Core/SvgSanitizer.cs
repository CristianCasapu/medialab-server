using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace MediaLabTv.Core;

/// <summary>
/// Sigla SVG incarcata de admin (SECURITY-AUDIT TV-2): se citeste ca XML (fara DTD/entitati) si se rescrie doar din
/// elementele si atributele unei liste permise. Se refuza de tot un SVG cu script, foreignObject, atribute on* sau
/// adrese javascript:. Se scot fara refuz: orice href/xlink:href care nu e „#fragment”, animate/set/use/image/style,
/// elementele si atributele necunoscute (ex. Inkscape) si orice url(...) care nu e url(#...).
/// Aceeasi clasa pe Emby si Jellyfin.
/// </summary>
public static partial class SvgSanitizer
{
    private const string SvgNs = "http://www.w3.org/2000/svg";
    private const string XlinkNs = "http://www.w3.org/1999/xlink";

    // Formele si textul static ale unei sigle; fara animatii, fara referinte la alte documente, fara CSS in <style>.
    private static readonly HashSet<string> Elements = new(StringComparer.Ordinal)
    {
        "svg", "g", "defs", "title", "desc", "symbol",
        "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
        "text", "tspan",
        "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern",
        "filter", "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feComposite", "feFlood", "feMerge",
        "feMergeNode", "feMorphology", "feDropShadow",
    };

    private static readonly HashSet<string> Attributes = new(StringComparer.Ordinal)
    {
        "id", "class", "style", "transform", "version", "viewBox", "preserveAspectRatio", "width", "height",
        "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr", "d", "points", "pathLength",
        "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
        "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "color",
        "clip-path", "clip-rule", "clipPathUnits", "mask", "maskUnits", "maskContentUnits", "visibility", "display",
        "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod",
        "patternUnits", "patternContentUnits", "patternTransform",
        "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "letter-spacing",
        "word-spacing", "dx", "dy", "rotate", "textLength", "lengthAdjust",
        "filter", "filterUnits", "primitiveUnits", "in", "in2", "result", "stdDeviation", "mode", "operator",
        "k1", "k2", "k3", "k4", "values", "type", "flood-color", "flood-opacity", "radius",
    };

    // Continut activ: sigla se refuza (mesaj clar pentru admin), nu doar se curata.
    private static readonly HashSet<string> Forbidden = new(StringComparer.OrdinalIgnoreCase) { "script", "foreignObject", "iframe", "embed", "object", "handler", "listener" };

    [GeneratedRegex(@"url\s*\(\s*['""]?\s*([^)'""\s]*)", RegexOptions.IgnoreCase)]
    private static partial Regex UrlFunction();

    [GeneratedRegex(@"[\s\u0000-\u001f]+")]
    private static partial Regex Blank();

    /// <summary>SVG-ul curatat (UTF-8) sau null daca nu e un SVG valid ori are continut activ.</summary>
    public static byte[]? Sanitize(byte[] data)
    {
        XDocument doc;
        try
        {
            var settings = new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Prohibit,
                XmlResolver = null,
                MaxCharactersFromEntities = 0,
                MaxCharactersInDocument = Branding.MaxLogoBytes * 2L,
                IgnoreProcessingInstructions = true,
                IgnoreComments = true,
            };
            using var stream = new MemoryStream(data);
            using var reader = XmlReader.Create(stream, settings);
            doc = XDocument.Load(reader, LoadOptions.None);
        }
        catch (Exception ex) when (ex is XmlException or InvalidOperationException or ArgumentException)
        {
            return null;
        }

        var root = doc.Root;
        if (root == null || root.Name.LocalName != "svg" || (root.Name.NamespaceName.Length > 0 && root.Name.NamespaceName != SvgNs))
        {
            return null;
        }

        if (HasActiveContent(root))
        {
            return null;
        }

        var clean = Copy(root);
        if (clean == null)
        {
            return null;
        }

        clean.SetAttributeValue(XNamespace.Xmlns + "xlink", XlinkNs);
        var output = new MemoryStream();
        using (var writer = XmlWriter.Create(output, new XmlWriterSettings { Encoding = new UTF8Encoding(false), OmitXmlDeclaration = false, Indent = false }))
        {
            new XDocument(clean).Save(writer);
        }

        return output.ToArray();
    }

    private static bool HasActiveContent(XElement root)
    {
        foreach (var e in root.DescendantsAndSelf())
        {
            if (Forbidden.Contains(e.Name.LocalName))
            {
                return true;
            }

            foreach (var a in e.Attributes())
            {
                if (a.Name.LocalName.StartsWith("on", StringComparison.OrdinalIgnoreCase) || Dangerous(a.Value))
                {
                    return true;
                }
            }
        }

        return false;
    }

    // Valoarea a trecut deja prin parserul XML (entitatile ca &#58; sunt decodate); spatiile si controlurile se ignora
    // ca in browsere („java\tscript:”).
    private static bool Dangerous(string value)
    {
        var v = Blank().Replace(value, string.Empty).ToLowerInvariant();
        return v.Contains("javascript:", StringComparison.Ordinal) || v.Contains("vbscript:", StringComparison.Ordinal)
            || v.Contains("data:text/html", StringComparison.Ordinal) || v.Contains("data:image/svg", StringComparison.Ordinal);
    }

    private static XElement? Copy(XElement source)
    {
        var ns = source.Name.NamespaceName;
        if ((ns.Length > 0 && ns != SvgNs) || !Elements.Contains(source.Name.LocalName))
        {
            return null;
        }

        var copy = new XElement(XName.Get(source.Name.LocalName, SvgNs));
        foreach (var a in source.Attributes())
        {
            if (a.IsNamespaceDeclaration)
            {
                continue;
            }

            var name = a.Name;
            var value = a.Value;
            if (name.LocalName == "href" && (name.NamespaceName.Length == 0 || name.NamespaceName == XlinkNs))
            {
                // Doar trimiteri in acelasi document (gradient, clipPath); niciun alt URL.
                if (IsFragment(value))
                {
                    copy.SetAttributeValue(XName.Get("href", XlinkNs), value.Trim());
                }

                continue;
            }

            if (name.NamespaceName == XNamespace.Xml.NamespaceName && name.LocalName == "space")
            {
                copy.SetAttributeValue(name, value);
                continue;
            }

            if (name.NamespaceName.Length > 0 || !Attributes.Contains(name.LocalName) || !UrlsAreFragments(value))
            {
                continue;
            }

            if (name.LocalName == "style" && !SafeStyle(value))
            {
                continue;
            }

            copy.SetAttributeValue(name, value);
        }

        foreach (var node in source.Nodes())
        {
            switch (node)
            {
                case XElement child:
                    var clean = Copy(child);
                    if (clean != null)
                    {
                        copy.Add(clean);
                    }

                    break;
                case XText text when source.Name.LocalName is "text" or "tspan" or "title" or "desc":
                    copy.Add(new XText(text.Value));
                    break;
            }
        }

        return copy;
    }

    private static bool IsFragment(string value)
    {
        var v = value.Trim();
        return v.Length > 1 && v[0] == '#' && v.Skip(1).All(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '.' or ':');
    }

    private static bool UrlsAreFragments(string value)
    {
        foreach (Match m in UrlFunction().Matches(value))
        {
            if (!IsFragment(m.Groups[1].Value))
            {
                return false;
            }
        }

        return true;
    }

    private static bool SafeStyle(string value)
    {
        var v = value.ToLowerInvariant();
        return !v.Contains('@') && !v.Contains("expression", StringComparison.Ordinal) && !v.Contains("behavior", StringComparison.Ordinal)
            && !v.Contains('\\') && !v.Contains("image-set", StringComparison.Ordinal);
    }
}
