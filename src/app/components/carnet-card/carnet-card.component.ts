import { NgStyle } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, personOutline } from 'ionicons/icons';
import {
  CARNET_CALENDAR,
  CARNET_CALENDAR_ICON_COLOR,
  CARNET_FECHA_VALOR_FONT_RATIO,
  CARNET_FIELD_LABEL_FONT_RATIO,
  CARNET_FRAME_BORDER_PX,
  CARNET_STRIPE_HEIGHT_RATIO,
} from '../../constants/carnet-standard-layout';
import { CARNET_HEIGHT, CARNET_WIDTH } from '../../constants/carnet.constants';
import { CarnetLayout } from '../../interfaces/carnet-layout.interface';
import {
  CarnetTheme,
  DEFAULT_CARNET_THEME,
} from '../../interfaces/carnet-theme.interface';
import { CarnetRenderAssets } from '../../services/carnet-compositor.service';
import { CarnetData } from '../../services/carnet.service';
import {
  formatFechaCortaCarnet,
  splitCarnetApellidosLines,
} from '../../utils/carnet-format.util';
import {
  applyFieldStyle,
  createCarnetLineMeasurer,
  fieldFontSizePx,
  fieldStyleToCss,
  getStandardCarnetLayout,
  qrStyleToCss,
  rectFieldToPixels,
} from '../../utils/carnet-layout.util';
import { carnetStripeGradient } from '../../utils/carnet-theme.util';

@Component({
  selector: 'app-carnet-card',
  templateUrl: './carnet-card.component.html',
  styleUrls: ['./carnet-card.component.scss'],
  standalone: true,
  imports: [IonIcon, NgStyle],
})
export class CarnetCardComponent implements OnInit, OnChanges {
  @Input({ required: true }) carnetData!: CarnetData;
  @Input() renderAssets: CarnetRenderAssets | null = null;
  @Input() flat = false;

  canvasWidth = CARNET_WIDTH;
  canvasHeight = CARNET_HEIGHT;
  stripeHeightPx = Math.round(CARNET_HEIGHT * CARNET_STRIPE_HEIGHT_RATIO);
  logoWatermarkSrc: string | null = null;
  theme: CarnetTheme = { ...DEFAULT_CARNET_THEME };
  stripeGradient = carnetStripeGradient(DEFAULT_CARNET_THEME);

  fotoFrameStyle: Record<string, string> = {};
  fotoInnerStyle: Record<string, string> = {};
  calendarStyle: Record<string, string> = {};
  stripeTextStyle: Record<string, string> = {};
  categoriaBlockStyle: Record<string, string> = {};
  nombresBlockStyle: Record<string, string> = {};
  apellidosBlockStyle: Record<string, string> = {};
  qrFrameStyle: Record<string, string> = {};
  qrInnerStyle: Record<string, string> = {};
  fechaBlockStyle: Record<string, string> = {};

  nombresText = '';
  apellidosLines: string[] = [];
  categoriaText = '';
  nombreAcademiaText = '';
  fechaValor = '';
  nombreColor = '#1a1a2e';
  categoriaColor = '#9d0208';
  fechaColor = '#333333';
  nombreWeight = '800';
  categoriaWeight = '700';
  fieldLabelFontPx = 14;
  categoriaValueFontPx = 24;
  nombresValueFontPx = 24;
  apellidosValueFontPx = 24;
  fechaLabelFontPx = 14;
  fechaValorFontPx = 20;

  private layout: CarnetLayout = getStandardCarnetLayout();

  constructor() {
    addIcons({ personOutline, calendarOutline });
  }

  ngOnInit(): void {
    this.applyLayout();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['renderAssets'] || changes['carnetData']) {
      this.applyLayout();
    }
  }

  private applyLayout(): void {
    const assets = this.renderAssets;
    this.canvasWidth = assets?.canvasWidth ?? CARNET_WIDTH;
    this.canvasHeight = assets?.canvasHeight ?? CARNET_HEIGHT;
    this.stripeHeightPx = Math.round(
      this.canvasHeight * CARNET_STRIPE_HEIGHT_RATIO
    );
    this.logoWatermarkSrc = assets?.logoDataUrl ?? null;
    this.theme = assets?.theme ?? { ...DEFAULT_CARNET_THEME };
    this.stripeGradient = carnetStripeGradient(this.theme);
    this.layout = assets?.layout ?? getStandardCarnetLayout();

    const { fields, styles } = this.layout;
    const frame = rectFieldToPixels(
      fields.foto,
      this.canvasWidth,
      this.canvasHeight
    );
    const inset = CARNET_FRAME_BORDER_PX + 2;

    this.fotoFrameStyle = {
      left: `${frame.x}px`,
      top: `${frame.y}px`,
      width: `${frame.width}px`,
      height: `${frame.height}px`,
      borderWidth: `${CARNET_FRAME_BORDER_PX}px`,
    };
    this.fotoInnerStyle = {
      width: `${frame.width - inset * 2}px`,
      height: `${frame.height - inset * 2}px`,
    };

    const calSize = Math.round(CARNET_CALENDAR.size * this.canvasWidth);
    this.calendarStyle = {
      left: `${Math.round(CARNET_CALENDAR.x * this.canvasWidth)}px`,
      top: `${Math.round(CARNET_CALENDAR.y * this.canvasHeight)}px`,
      fontSize: `${calSize}px`,
      width: `${calSize}px`,
      height: `${calSize}px`,
      color: CARNET_CALENDAR_ICON_COLOR,
    };

    const stripeField = fields.nombreAcademia;
    const stripeFont = fieldFontSizePx(
      { ...stripeField, fontSizeRatio: stripeField.fontSizeRatio ?? 0.058 },
      this.canvasHeight
    );
    this.stripeTextStyle = {
      fontSize: `${stripeFont}px`,
      fontWeight: styles?.nombreAcademia?.weight ?? '700',
      color: styles?.nombreAcademia?.color ?? '#ffffff',
    };

    this.fieldLabelFontPx = Math.round(
      this.canvasHeight * CARNET_FIELD_LABEL_FONT_RATIO
    );
    this.categoriaBlockStyle = fieldStyleToCss(
      fields.categoria,
      this.canvasWidth,
      this.canvasHeight
    );
    this.nombresBlockStyle = fieldStyleToCss(
      fields.nombres,
      this.canvasWidth,
      this.canvasHeight
    );
    this.apellidosBlockStyle = fieldStyleToCss(
      fields.apellidos,
      this.canvasWidth,
      this.canvasHeight
    );
    this.categoriaValueFontPx = fieldFontSizePx(
      fields.categoria,
      this.canvasHeight
    );
    this.nombresValueFontPx = fieldFontSizePx(fields.nombres, this.canvasHeight);
    this.apellidosValueFontPx = fieldFontSizePx(
      fields.apellidos,
      this.canvasHeight
    );

    const qrStyles = qrStyleToCss(
      fields.qr,
      this.canvasWidth,
      this.canvasHeight
    );
    this.qrFrameStyle = qrStyles.frame;
    this.qrInnerStyle = qrStyles.inner;

    const fechaRect = rectFieldToPixels(
      fields.fecha,
      this.canvasWidth,
      this.canvasHeight
    );
    this.fechaBlockStyle = {
      left: `${fechaRect.x}px`,
      top: `${fechaRect.y}px`,
      width: `${fechaRect.width}px`,
    };
    this.fechaLabelFontPx = fieldFontSizePx(fields.fecha, this.canvasHeight);
    this.fechaValorFontPx = Math.round(
      this.canvasHeight * CARNET_FECHA_VALOR_FONT_RATIO
    );

    this.nombresText = applyFieldStyle(
      styles?.nombres,
      this.carnetData?.nombresDisplay ?? ''
    );
    const apellidosValue = applyFieldStyle(
      styles?.apellidos,
      this.carnetData?.apellidosDisplay ?? ''
    );
    const apellidosFontPx = fieldFontSizePx(
      fields.apellidos,
      this.canvasHeight
    );
    const apellidosRect = rectFieldToPixels(
      fields.apellidos,
      this.canvasWidth,
      this.canvasHeight
    );
    const measureApellido = createCarnetLineMeasurer(
      (styles?.apellidos?.weight as '800') ?? '800'
    );
    this.apellidosLines = splitCarnetApellidosLines(apellidosValue, {
      maxWidth: apellidosRect.width,
      measure: (line) => measureApellido(line, apellidosFontPx),
    });
    this.categoriaText = this.carnetData?.categoriaDisplay ?? '';
    this.nombreAcademiaText = applyFieldStyle(
      styles?.nombreAcademia,
      this.carnetData?.nombreAcademia ?? ''
    );
    this.fechaValor = formatFechaCortaCarnet(
      this.carnetData?.alumno.fecha_nacimiento ?? ''
    );

    this.nombreColor = styles?.nombres?.color ?? '#1a1a2e';
    this.categoriaColor = styles?.categoria?.color ?? '#9d0208';
    this.fechaColor = styles?.fecha?.color ?? '#333333';
    this.nombreWeight = styles?.nombres?.weight ?? '800';
    this.categoriaWeight = styles?.categoria?.weight ?? '700';
  }
}
